"""Run the Xona eval with transformers (+ optional PEFT LoRA adapter) on CPU or GPU.

Same questions, prompt and scoring as run_eval.py, so a base model and an
adapter can be compared on one backend and one precision.

    python eval/run_eval_hf.py --base Qwen/Qwen3.5-4B --adapter uzeresearch/adaption_xona_research_combined_v1 --out eval/results/xona-adapter
    python eval/run_eval_hf.py --base Qwen/Qwen3.5-4B --out eval/results/qwen3.5-4b-base-hf
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch

from run_eval import CHECKS, SYSTEM, build_prompt, score


def load(base: str, adapter: str | None):
    from transformers import AutoModelForImageTextToText, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(base)
    model = AutoModelForImageTextToText.from_pretrained(base, dtype=torch.bfloat16)
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter)
        model = model.merge_and_unload()
    return tok, model.eval()


@torch.inference_mode()
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--adapter")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--max-new-tokens", type=int, default=600)
    ap.add_argument("--only", nargs="*", help="question ids to run first (then the rest)")
    a = ap.parse_args()

    tok, model = load(a.base, a.adapter)
    qs = [json.loads(l) for l in (Path(__file__).parent / "questions.jsonl").read_text().splitlines() if l.strip()]
    a.out.mkdir(parents=True, exist_ok=True)
    # Resume: the machine can be restarted mid-run, so keep finished answers.
    part = a.out / "partial.json"
    rows = json.loads(part.read_text()) if part.exists() else []
    done = {r["id"] for r in rows}
    if a.only:
        qs = [q for q in qs if q["id"] in a.only] + [q for q in qs if q["id"] not in a.only]
    for q in qs:
        if q["id"] in done:
            continue
        msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": build_prompt(q)}]
        text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        ids = tok(text, return_tensors="pt")
        t = time.time()
        out = model.generate(**ids, max_new_tokens=a.max_new_tokens, do_sample=False)
        ans = tok.decode(out[0, ids["input_ids"].shape[1]:], skip_special_tokens=True)
        s = score(q, ans)
        rows.append({"id": q["id"], "type": q["type"], "seconds": round(time.time() - t, 1), **s, "answer": ans})
        print(q["id"], s, flush=True)
        (a.out / "partial.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    total = sum(r["score"] for r in rows)
    summary = {"model": a.base, "adapter": a.adapter, "questions": len(rows), "score": total,
               "max_score": 6 * len(rows), "per_check": {k: sum(r[k] for r in rows) for k in CHECKS},
               "results": rows}
    (a.out / "results.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in summary.items() if k != "results"}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
