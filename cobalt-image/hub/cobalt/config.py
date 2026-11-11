"""Model registry and generation defaults.

Every entry records its lineage and license so nothing here can be mistaken
for independently trained COBALT weights.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelSpec:
    id: str
    base_repo: str          # Hugging Face repo the weights come from
    base_license: str
    pipeline_class: str     # diffusers pipeline class name
    default_steps: int
    default_guidance: float
    weights_origin: str     # "third-party" | "cobalt-finetune" | "cobalt-independent"
    lora: str | None = None  # optional COBALT adapter (none exists yet)
    notes: str = ""
    resolutions: tuple[int, ...] = (512, 768, 1024)


MODELS: dict[str, ModelSpec] = {
    "cobalt-image-v0.1": ModelSpec(
        id="cobalt-image-v0.1",
        base_repo="black-forest-labs/FLUX.2-klein-4B",
        base_license="apache-2.0",
        pipeline_class="Flux2KleinPipeline",
        default_steps=4,
        default_guidance=1.0,
        weights_origin="third-party",
        notes="Phase A. Unmodified FLUX.2 [klein] 4B weights behind the COBALT pipeline.",
    ),
}

DEFAULT_MODEL = "cobalt-image-v0.1"

# width, height — all multiples of 16 as the latent grid requires.
ASPECT_RATIOS: dict[str, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "4:3": (1152, 864),
    "3:4": (864, 1152),
    "3:2": (1216, 832),
    "2:3": (832, 1216),
}

MAX_PIXELS = 2048 * 2048
MAX_STEPS = 50
MAX_IMAGES = 4


def model_path(spec: ModelSpec) -> str:
    """Local directory override (COBALT_MODEL_PATH) or the Hub repo id."""
    return os.environ.get("COBALT_MODEL_PATH") or spec.base_repo


def scale_to(width: int, height: int, long_side: int) -> tuple[int, int]:
    """Scale an aspect preset so its long side is `long_side`, snapped to 16."""
    s = long_side / max(width, height)
    return max(16, round(width * s / 16) * 16), max(16, round(height * s / 16) * 16)
