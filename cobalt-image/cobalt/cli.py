"""python -m cobalt.cli "a prompt" --size 512 --out out.png"""
from __future__ import annotations

import argparse
import json

from .config import ASPECT_RATIOS, DEFAULT_MODEL, scale_to
from .engine import CobaltEngine


def main() -> None:
    ap = argparse.ArgumentParser(description="COBALT Image generation")
    ap.add_argument("prompt")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--aspect", default="1:1", choices=sorted(ASPECT_RATIOS))
    ap.add_argument("--size", type=int, default=1024, help="long side in pixels")
    ap.add_argument("--steps", type=int)
    ap.add_argument("--guidance", type=float)
    ap.add_argument("--seed", type=int)
    ap.add_argument("-n", "--num-images", type=int, default=1)
    ap.add_argument("--mode", default="auto", choices=["auto", "full", "staged"])
    ap.add_argument("--enhance", action="store_true", help="expand the prompt with the model's own text encoder")
    ap.add_argument("--out", default="cobalt.png")
    a = ap.parse_args()

    w, h = scale_to(*ASPECT_RATIOS[a.aspect], a.size)
    eng = CobaltEngine(a.model, mode=a.mode)
    res = eng.generate(
        a.prompt, w, h, a.steps, a.guidance, a.seed, a.num_images,
        on_step=lambda i, n: print(f"step {i}/{n}", flush=True),
        enhance=a.enhance,
    )
    stem, _, ext = a.out.rpartition(".")
    for i, img in enumerate(res.images):
        path = a.out if len(res.images) == 1 else f"{stem}_{i}.{ext}"
        img.save(path)
        print("saved", path)
    print(json.dumps(res.meta(), indent=2))


if __name__ == "__main__":
    main()
