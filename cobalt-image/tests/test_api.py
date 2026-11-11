"""API contract tests.

These use a stub engine that returns solid-colour images so the HTTP layer
(validation, auth, rate limit, queue, ownership) can be tested without model
weights. The stub exists only in this file; it is never used to serve users.
"""
import importlib

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from cobalt.engine import GenerationResult


class StubEngine:
    def __init__(self, fail=False):
        self.fail = fail

    def generate(self, prompt, width, height, steps, guidance, seed, n, on_step=None, enhance=False):
        if self.fail:
            raise RuntimeError("boom")
        if on_step:
            on_step(1, 1)
        return GenerationResult(
            images=[Image.new("RGB", (width, height), (0, 71, 171)) for _ in range(n)],
            prompt=prompt, prompt_used=prompt + (" [enhanced]" if enhance else ""),
            seed=seed or 0, width=width, height=height, steps=steps or 1, guidance=guidance or 1.0,
            model="cobalt-image-v0.1", mode="stub", device="cpu", timings={})


def client(monkeypatch, keys="", rate="30", fail=False):
    monkeypatch.setenv("COBALT_API_KEYS", keys)
    monkeypatch.setenv("COBALT_RATE_LIMIT_PER_MIN", rate)
    import api.server as s
    importlib.reload(s)
    return TestClient(s.create_app(lambda model: StubEngine(fail)))


def test_health_and_models(monkeypatch):
    c = client(monkeypatch)
    assert c.get("/health").json()["status"] == "ok"
    m = c.get("/v1/models").json()["data"][0]
    assert m["id"] == "cobalt-image-v0.1" and m["weights_origin"] == "third-party"


def test_generate_wait_and_fetch(monkeypatch):
    c = client(monkeypatch)
    r = c.post("/v1/images/generations", json={"prompt": "a cat", "aspect_ratio": "16:9", "size": 512, "n": 2, "wait": True})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "succeeded" and len(body["data"]) == 2
    assert (body["meta"]["width"], body["meta"]["height"]) == (512, 288)
    img = c.get(body["data"][1]["url"])
    assert img.status_code == 200 and img.content[:4] == b"\x89PNG"
    assert c.get(f"/v1/images/{body['id']}").json()["status"] == "succeeded"
    assert c.get("/v1/usage").json()["images"] == 2


def test_async_job_is_queued(monkeypatch):
    c = client(monkeypatch)
    r = c.post("/v1/images/generations", json={"prompt": "a dog"})
    assert r.status_code == 202 and r.json()["status"] in ("queued", "running", "succeeded")


@pytest.mark.parametrize("payload", [
    {"prompt": ""},
    {"prompt": "x", "width": 500, "height": 512},
    {"prompt": "x", "width": 512},
    {"prompt": "x", "aspect_ratio": "7:5"},
    {"prompt": "x", "aspect_ratio": "1:1", "width": 512, "height": 512},
    {"prompt": "x", "n": 9},
    {"prompt": "x", "steps": 0},
    {"prompt": "x", "model": "nope"},
])
def test_validation(monkeypatch, payload):
    assert client(monkeypatch).post("/v1/images/generations", json=payload).status_code == 422


def test_auth_and_ownership(monkeypatch):
    c = client(monkeypatch, keys="key-aaaaaa,key-bbbbbb")
    assert c.get("/v1/models").status_code == 401
    assert c.get("/health").status_code == 200
    a = {"Authorization": "Bearer key-aaaaaa"}
    b = {"Authorization": "Bearer key-bbbbbb"}
    job = c.post("/v1/images/generations", json={"prompt": "x", "size": 256, "wait": True}, headers=a).json()
    assert c.get(f"/v1/images/{job['id']}", headers=a).status_code == 200
    assert c.get(f"/v1/images/{job['id']}", headers=b).status_code == 404


def test_rate_limit(monkeypatch):
    c = client(monkeypatch, keys="key-aaaaaa", rate="2")
    h = {"Authorization": "Bearer key-aaaaaa"}
    assert [c.get("/v1/models", headers=h).status_code for _ in range(3)] == [200, 200, 429]


def test_engine_failure_is_reported(monkeypatch):
    c = client(monkeypatch, fail=True)
    r = c.post("/v1/images/generations", json={"prompt": "x", "wait": True})
    assert r.status_code == 500 and r.json()["status"] == "failed" and "boom" in r.json()["error"]
    assert r.json()["data"] == []


def test_enhance_flag_reaches_engine_and_is_reported(monkeypatch):
    c = client(monkeypatch)
    off = c.post("/v1/images/generations", json={"prompt": "a cat", "size": 256, "wait": True}).json()
    on = c.post("/v1/images/generations", json={"prompt": "a cat", "size": 256, "wait": True, "enhance": True}).json()
    assert off["meta"]["prompt_used"] == "a cat"
    assert on["meta"]["prompt"] == "a cat" and on["meta"]["prompt_used"] == "a cat [enhanced]"
