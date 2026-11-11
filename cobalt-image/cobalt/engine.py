"""Inference engine.

Two execution modes, picked from the hardware actually present:

* full   — whole pipeline resident on one device (GPU with enough VRAM).
* staged — text encoder and transformer are never in memory together. Each
           request loads the encoder, encodes, frees it, then loads the
           transformer. Slow, but runs in ~9 GB of RAM with no GPU.
"""
from __future__ import annotations

import gc
import time
from dataclasses import dataclass, asdict
from typing import Callable

import torch

from .config import DEFAULT_MODEL, MODELS, ModelSpec, model_path


@dataclass
class GenerationResult:
    images: list            # list[PIL.Image.Image]
    seed: int
    width: int
    height: int
    steps: int
    guidance: float
    model: str
    mode: str
    device: str
    timings: dict

    def meta(self) -> dict:
        d = asdict(self)
        d.pop("images")
        return d


def detect_hardware() -> dict:
    info = {
        "cuda": torch.cuda.is_available(),
        "cpu_threads": torch.get_num_threads(),
        "ram_gb": None,
        "vram_gb": None,
        "gpu": None,
    }
    try:
        import os
        info["ram_gb"] = round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 2**30, 1)
    except (ValueError, OSError):
        pass
    if info["cuda"]:
        p = torch.cuda.get_device_properties(0)
        info["gpu"] = p.name
        info["vram_gb"] = round(p.total_memory / 2**30, 1)
    return info


class CobaltEngine:
    def __init__(self, model: str = DEFAULT_MODEL, device: str = "auto", mode: str = "auto"):
        if model not in MODELS:
            raise ValueError(f"unknown model {model!r}; known: {sorted(MODELS)}")
        self.spec: ModelSpec = MODELS[model]
        self.path = model_path(self.spec)
        self.hw = detect_hardware()
        self.device = ("cuda" if self.hw["cuda"] else "cpu") if device == "auto" else device
        if mode == "auto":
            if self.device == "cuda":
                mode = "full"
            else:
                mode = "full" if (self.hw["ram_gb"] or 0) >= 24 else "staged"
        if mode not in ("full", "staged"):
            raise ValueError("mode must be auto, full or staged")
        self.mode = mode
        self.dtype = torch.bfloat16
        self._pipe = None

    # -- loading -----------------------------------------------------------
    def _cls(self):
        import diffusers
        return getattr(diffusers, self.spec.pipeline_class)

    def _load(self, **overrides):
        pipe = self._cls().from_pretrained(self.path, torch_dtype=self.dtype, **overrides)
        if self.spec.lora and overrides.get("transformer", True) is not None:
            pipe.load_lora_weights(self.spec.lora)
        if self.device == "cuda":
            # Offload keeps peak VRAM near the largest single component.
            if (self.hw["vram_gb"] or 0) < 20:
                pipe.enable_model_cpu_offload()
            else:
                pipe.to("cuda")
        return pipe

    def load(self):
        """Warm the pipeline (full mode only; staged mode loads per request)."""
        if self.mode == "full" and self._pipe is None:
            self._pipe = self._load()
        return self

    # -- generation --------------------------------------------------------
    @torch.inference_mode()
    def generate(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int | None = None,
        guidance: float | None = None,
        seed: int | None = None,
        num_images: int = 1,
        on_step: Callable[[int, int], None] | None = None,
    ) -> GenerationResult:
        if not prompt or not prompt.strip():
            raise ValueError("prompt is empty")
        if width % 16 or height % 16:
            raise ValueError("width and height must be multiples of 16")
        steps = steps or self.spec.default_steps
        guidance = self.spec.default_guidance if guidance is None else guidance
        if seed is None:
            seed = int(torch.randint(0, 2**31 - 1, (1,)).item())
        gen = torch.Generator("cpu").manual_seed(seed)
        timings: dict = {}

        def cb(pipe, i, t, kw):
            if on_step:
                on_step(i + 1, steps)
            return kw

        common = dict(
            width=width, height=height, num_inference_steps=steps,
            guidance_scale=guidance, generator=gen, callback_on_step_end=cb,
        )

        t0 = time.time()
        if self.mode == "full":
            self.load()
            images = self._pipe(prompt=prompt, num_images_per_prompt=num_images, **common).images
            timings["generate_s"] = round(time.time() - t0, 2)
        else:
            enc = self._load(transformer=None, vae=None)
            timings["load_encoder_s"] = round(time.time() - t0, 2)
            t = time.time()
            embeds, _ = enc.encode_prompt(prompt=prompt, device=self.device, num_images_per_prompt=num_images)
            embeds = embeds.to("cpu")
            timings["encode_s"] = round(time.time() - t, 2)
            del enc
            gc.collect()
            if self.device == "cuda":
                torch.cuda.empty_cache()

            t = time.time()
            den = self._load(text_encoder=None, tokenizer=None)
            timings["load_transformer_s"] = round(time.time() - t, 2)
            t = time.time()
            images = den(prompt_embeds=embeds.to(self.device), **common).images
            timings["denoise_decode_s"] = round(time.time() - t, 2)
            del den
            gc.collect()
        timings["total_s"] = round(time.time() - t0, 2)

        return GenerationResult(
            images=images, seed=seed, width=width, height=height, steps=steps,
            guidance=guidance, model=self.spec.id, mode=self.mode, device=self.device,
            timings=timings,
        )
