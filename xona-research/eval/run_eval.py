"""Score a research model on source-grounded Turkish questions.

Each question comes with numbered sources. Automatic checks per answer:
  cites        uses at least one [n] citation
  valid_cites  every [n] points to a source that exists
  facts        contains every must_include string
  behaviour    type-specific: flags conflict / says the answer is not in the
               sources / notes the outdated or unreliable source
  turkish      answer is written in Turkish

These are string heuristics: they catch missing citations and invented
source numbers well, and judge behaviour only roughly. Read the answers too.

    python eval/run_eval.py --model base/Qwen3.5-4B-Q4_K_M.gguf --out eval/results/base
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

SYSTEM = (
    "Sen bir araştırma asistanısın. Yalnızca kullanıcının verdiği numaralı kaynaklara "
    "dayanarak Türkçe cevap ver. Her bilginin yanına kaynağını [1], [2] biçiminde yaz. "
    "Kaynaklar çelişiyorsa, eskiyse ya da güvenilmezse bunu açıkça belirt. "
    "Kaynaklarda olmayan bilgi, sayı ya da alıntı uydurma; cevap kaynaklarda yoksa bunu söyle."
)

BEHAVIOUR = {
    "conflict": r"çeliş|farklı|tutarsız|uyuşm",
    "unanswerable": r"yer almıyor|bulunmuyor|belirtilmemiş|bilgi yok|yok\b|paylaşılmamış|yayımlanmadı|yayımlanmamış|veremiyorum|mevcut değil",
    "partial": r"paylaşılmadı|paylaşılmamış|belirtilmemiş|bilgi yok|bulunmuyor|yer almıyor",
    "outdated": r"güncel|eski|daha yeni|2024|2026",
    "unreliable": r"güvenilir|kanıt|bilimsel|abartı|doğrulanma|kaynak belirtilme",
    "fact_check": r"yanlış|doğru değil|abartılı|hatalı|1,2",
    "answerable": r".",
}
TURKISH = re.compile(r"[çğıöşüÇĞİÖŞÜ]")


def build_prompt(q: dict) -> str:
    parts = [f"Soru: {q['question']}", "", "Kaynaklar:"]
    for i, s in enumerate(q["sources"], 1):
        parts.append(f"[{i}] {s['title']} ({s['date']}) {s['url']}\n{s['text']}")
    return "\n".join(parts)


def score(q: dict, answer: str) -> dict:
    # Drop any visible thinking block before scoring.
    ans = re.sub(r"<think>.*?</think>", "", answer, flags=re.S).strip()
    cites = [int(n) for n in re.findall(r"\[(\d+)\]", ans)]
    low = ans.lower()
    r = {
        "cites": bool(cites),
        "valid_cites": all(1 <= n <= len(q["sources"]) for n in cites),
        "facts": all(f.lower() in low for f in q["must_include"]),
        "behaviour": bool(re.search(BEHAVIOUR[q["type"]], low)),
        "turkish": bool(TURKISH.search(ans)),
    }
    r["score"] = sum(r.values())
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="GGUF file")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--max-tokens", type=int, default=700)
    ap.add_argument("--threads", type=int, default=4)
    a = ap.parse_args()

    from llama_cpp import Llama
    llm = Llama(a.model, n_ctx=4096, n_threads=a.threads, verbose=False)
    qs = [json.loads(l) for l in (Path(__file__).parent / "questions.jsonl").read_text().splitlines() if l.strip()]
    a.out.mkdir(parents=True, exist_ok=True)
    rows = []
    for q in qs:
        t = time.time()
        res = llm.create_chat_completion(
            messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": build_prompt(q)}],
            # Qwen3.5's template leaves thinking off unless enable_thinking is set,
            # so the whole token budget goes to the answer.
            max_tokens=a.max_tokens, temperature=0.2,
        )
        ans = res["choices"][0]["message"]["content"]
        s = score(q, ans)
        rows.append({"id": q["id"], "type": q["type"], "seconds": round(time.time() - t, 1), **s, "answer": ans})
        print(q["id"], s, flush=True)
    total = sum(r["score"] for r in rows)
    summary = {"model": a.model, "questions": len(rows), "score": total, "max_score": 5 * len(rows),
               "per_check": {k: sum(r[k] for r in rows) for k in ["cites", "valid_cites", "facts", "behaviour", "turkish"]},
               "results": rows}
    (a.out / "results.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in summary.items() if k != "results"}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
