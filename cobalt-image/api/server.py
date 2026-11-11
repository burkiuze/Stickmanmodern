"""COBALT Image HTTP API.

    POST /v1/images/generations   queue a generation (or wait for it)
    GET  /v1/images/{id}          job status and image links
    GET  /v1/images/{id}/{n}.png  image bytes
    GET  /v1/models               model registry with lineage
    GET  /health

Single-process implementation: an in-memory queue and one worker thread per
engine. Jobs and usage counters do not survive a restart; the Postgres/Redis
backed version is a later milestone (see docs/ROADMAP.md).
"""
from __future__ import annotations

import io
import os
import queue
import threading
import time
import uuid
from collections import defaultdict, deque
from dataclasses import asdict

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field, model_validator

from cobalt import __version__
from cobalt.config import ASPECT_RATIOS, DEFAULT_MODEL, MAX_IMAGES, MAX_PIXELS, MAX_STEPS, MODELS, scale_to

MAX_QUEUE = int(os.environ.get("COBALT_MAX_QUEUE", "32"))
RATE_LIMIT = int(os.environ.get("COBALT_RATE_LIMIT_PER_MIN", "30"))


class GenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    model: str = DEFAULT_MODEL
    aspect_ratio: str | None = None
    size: int = Field(default=1024, ge=256, le=2048, description="long side when aspect_ratio is set")
    width: int | None = Field(default=None, ge=256, le=2048)
    height: int | None = Field(default=None, ge=256, le=2048)
    steps: int | None = Field(default=None, ge=1, le=MAX_STEPS)
    guidance: float | None = Field(default=None, ge=0, le=20)
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)
    n: int = Field(default=1, ge=1, le=MAX_IMAGES)
    enhance: bool = Field(default=False, description="rewrite the prompt with more visual detail before generating")
    wait: bool = False

    @model_validator(mode="after")
    def _resolve(self):
        if self.model not in MODELS:
            raise ValueError(f"unknown model {self.model!r}")
        if (self.width is None) != (self.height is None):
            raise ValueError("give both width and height, or neither")
        if self.width is None:
            ar = self.aspect_ratio or "1:1"
            if ar not in ASPECT_RATIOS:
                raise ValueError(f"aspect_ratio must be one of {sorted(ASPECT_RATIOS)}")
            self.width, self.height = scale_to(*ASPECT_RATIOS[ar], self.size)
        elif self.aspect_ratio:
            raise ValueError("give aspect_ratio or width/height, not both")
        if self.width % 16 or self.height % 16:
            raise ValueError("width and height must be multiples of 16")
        if self.width * self.height > MAX_PIXELS:
            raise ValueError("image too large")
        return self


class Job:
    def __init__(self, req: GenerationRequest, owner: str):
        self.id = "img_" + uuid.uuid4().hex[:24]
        self.req, self.owner = req, owner
        self.status = "queued"
        self.created = time.time()
        self.finished: float | None = None
        self.progress = {"step": 0, "steps": req.steps}
        self.error: str | None = None
        self.meta: dict | None = None
        self.images: list[bytes] = []
        self.done = threading.Event()

    def view(self) -> dict:
        return {
            "id": self.id, "object": "image.generation", "status": self.status,
            "created": int(self.created), "model": self.req.model, "prompt": self.req.prompt,
            "progress": self.progress, "error": self.error, "meta": self.meta,
            "data": [{"url": f"/v1/images/{self.id}/{i}.png"} for i in range(len(self.images))],
        }


def create_app(engine_factory=None) -> FastAPI:
    """engine_factory(model_id) -> object with .generate(...). Injected in tests."""
    if engine_factory is None:
        from cobalt.engine import CobaltEngine
        engine_factory = lambda model: CobaltEngine(model)  # noqa: E731

    app = FastAPI(title="COBALT Image API", version=__version__)
    keys = {k.strip() for k in os.environ.get("COBALT_API_KEYS", "").split(",") if k.strip()}
    jobs: dict[str, Job] = {}
    q: "queue.Queue[Job]" = queue.Queue(maxsize=MAX_QUEUE)
    engines: dict = {}
    hits: dict[str, deque] = defaultdict(deque)
    usage: dict[str, dict] = defaultdict(lambda: {"requests": 0, "images": 0, "seconds": 0.0})
    lock = threading.Lock()

    def worker():
        while True:
            job = q.get()
            job.status = "running"
            t0 = time.time()
            try:
                if job.req.model not in engines:
                    engines[job.req.model] = engine_factory(job.req.model)
                r = job.req

                def on_step(i, n):
                    job.progress = {"step": i, "steps": n}

                res = engines[r.model].generate(
                    r.prompt, r.width, r.height, r.steps, r.guidance, r.seed, r.n, on_step=on_step,
                    enhance=r.enhance)
                for img in res.images:
                    buf = io.BytesIO()
                    img.save(buf, "PNG")
                    job.images.append(buf.getvalue())
                job.meta = res.meta()
                job.status = "succeeded"
            except Exception as e:  # surfaced to the client, never swallowed
                job.status, job.error = "failed", f"{type(e).__name__}: {e}"
            finally:
                job.finished = time.time()
                with lock:
                    u = usage[job.owner]
                    u["images"] += len(job.images)
                    u["seconds"] += job.finished - t0
                job.done.set()
                q.task_done()

    threading.Thread(target=worker, daemon=True, name="cobalt-worker").start()

    def auth(authorization: str | None = Header(default=None)) -> str:
        if not keys:
            return "anonymous"  # dev mode: no COBALT_API_KEYS configured
        token = (authorization or "").removeprefix("Bearer ").strip()
        if token not in keys:
            raise HTTPException(401, "missing or invalid API key")
        now = time.time()
        with lock:
            window = hits[token]
            while window and now - window[0] > 60:
                window.popleft()
            if len(window) >= RATE_LIMIT:
                raise HTTPException(429, "rate limit exceeded", headers={"Retry-After": "60"})
            window.append(now)
        return token[-6:]

    @app.get("/health")
    def health():
        return {"status": "ok", "version": __version__, "queue_depth": q.qsize(),
                "auth": "api-key" if keys else "disabled", "loaded_models": sorted(engines)}

    @app.get("/v1/models")
    def models(_: str = Depends(auth)):
        return {"object": "list", "data": [{"object": "model", **asdict(m)} for m in MODELS.values()]}

    @app.post("/v1/images/generations", status_code=202)
    def generate(req: GenerationRequest, response: Response, owner: str = Depends(auth)):
        job = Job(req, owner)
        try:
            q.put_nowait(job)
        except queue.Full:
            raise HTTPException(503, "generation queue is full", headers={"Retry-After": "30"})
        jobs[job.id] = job
        with lock:
            usage[owner]["requests"] += 1
        if req.wait:
            job.done.wait()
            response.status_code = 200 if job.status == "succeeded" else 500
        return job.view()

    def owned(job_id: str, owner: str) -> Job:
        job = jobs.get(job_id)
        if job is None or job.owner != owner:
            raise HTTPException(404, "no such image job")
        return job

    @app.get("/v1/images/{job_id}")
    def get_job(job_id: str, owner: str = Depends(auth)):
        return owned(job_id, owner).view()

    @app.get("/v1/images/{job_id}/{index}.png")
    def get_image(job_id: str, index: int, owner: str = Depends(auth)):
        job = owned(job_id, owner)
        if not 0 <= index < len(job.images):
            raise HTTPException(404, "no such image")
        return Response(job.images[index], media_type="image/png")

    @app.get("/v1/usage")
    def get_usage(owner: str = Depends(auth)):
        with lock:
            return dict(usage[owner])

    return app


app = None


def get_app() -> FastAPI:  # uvicorn api.server:get_app --factory
    return create_app()
