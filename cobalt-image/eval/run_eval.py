"""Generate the prompt suite with fixed seeds and score prompt-image agreement.

Metric: CLIP score = 100 * cosine(image, text) with openai/clip-vit-base-patch32.
It is a coarse proxy for prompt adherence. It does not measure photorealism,
anatomy, counting or text accuracy; those need GenEval / T2I-CompBench and
human review, which this script does not run.

    python eval/run_eval.py --size 512 --limit 2 --out eval/results/run1
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cobalt.config import DEFAULT_MODEL, MODELS  # noqa: E402
from cobalt.engine import CobaltEngine  # noqa: E402

CLIP_ID = "openai/clip-vit-base-patch32"


def clip_scores(pairs):
    from transformers import CLIPModel, CLIPProcessor
    model, proc = CLIPModel.from_pretrained(CLIP_ID).eval(), CLIPProcessor.from_pretrained(CLIP_ID)
    out = []
    with torch.inference_mode():
        for img, text in pairs:
            b = proc(text=[text], images=img, return_tensors="pt", truncation=True, max_length=77, padding=True)
            o = model(**b)
            i = o.image_embeds / o.image_embeds.norm(dim=-1, keepdim=True)
            t = o.text_embeds / o.text_embeds.norm(dim=-1, keepdim=True)
            out.append(round(100 * float((i * t).sum()), 2))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only", nargs="*", help="prompt ids")
    ap.add_argument("--out", type=Path, default=Path("eval/results/latest"))
    a = ap.parse_args()

    suite = json.loads((Path(__file__).parent / "prompts.json").read_text())
    if a.only:
        suite = [p for p in suite if p["id"] in a.only]
    if a.limit:
        suite = suite[: a.limit]
    a.out.mkdir(parents=True, exist_ok=True)

    eng = CobaltEngine(a.model)
    rows, pairs = [], []
    for p in suite:
        res = eng.generate(p["prompt"], a.size, a.size, seed=a.seed)
        f = a.out / f"{p['id']}.png"
        res.images[0].save(f)
        pairs.append((res.images[0], p["prompt"]))
        rows.append({**p, "file": f.name, "seconds": res.timings["total_s"]})
        print(p["id"], res.timings, flush=True)
    for r, s in zip(rows, clip_scores(pairs)):
        r["clip_score"] = s

    spec = MODELS[a.model]
    summary = {
        "model": spec.id, "base_repo": spec.base_repo, "weights_origin": spec.weights_origin,
        "size": a.size, "seed": a.seed, "steps": spec.default_steps, "guidance": spec.default_guidance,
        "mode": eng.mode, "device": eng.device, "hardware": eng.hw, "platform": platform.platform(),
        "torch": torch.__version__, "metric": f"CLIP score ({CLIP_ID})",
        "n_prompts": len(rows), "mean_clip_score": round(sum(r["clip_score"] for r in rows) / len(rows), 2),
        "results": rows,
    }
    (a.out / "results.json").write_text(json.dumps(summary, indent=2))
    md = [f"# Eval run — {spec.id}", "",
          f"- Weights: `{spec.base_repo}` ({spec.weights_origin})",
          f"- {a.size}x{a.size}, {spec.default_steps} steps, guidance {spec.default_guidance}, seed {a.seed}",
          f"- Device: {eng.device} ({eng.mode} mode), {eng.hw}",
          f"- Metric: {summary['metric']} — prompt-agreement proxy only",
          f"- Prompts: {len(rows)} of the suite's {len(json.loads((Path(__file__).parent / 'prompts.json').read_text()))}", "",
          "| id | category | CLIP score | seconds |", "|---|---|---|---|"]
    md += [f"| {r['id']} | {r['category']} | {r['clip_score']} | {r['seconds']} |" for r in rows]
    md += ["", f"Mean CLIP score: **{summary['mean_clip_score']}**", "",
           "No comparison models were run, so this says nothing about relative quality."]
    (a.out / "REPORT.md").write_text("\n".join(md) + "\n")
    print((a.out / "REPORT.md").read_text())


if __name__ == "__main__":
    main()
