"""Turn a folder of licensed images into a training manifest.

Input:  a directory of images plus a provenance CSV with the columns
        file,caption,source,license   (license must be on the allow-list)
Output: <out>/metadata.jsonl  one accepted image per line
        <out>/report.json     counts and every rejection with its reason

Rejects: unreadable files, missing provenance, licenses not on the allow-list,
images under the minimum side, empty/too-short captions, exact duplicates
(sha256) and near duplicates (64-bit difference hash).

    python training/prepare_dataset.py images/ provenance.csv --out dataset/
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from PIL import Image

ALLOWED_LICENSES = {"cc0-1.0", "cc-by-4.0", "cc-by-sa-4.0", "public-domain", "own-work", "licensed"}


def dhash(img: Image.Image) -> int:
    g = img.convert("L").resize((9, 8), Image.LANCZOS)
    px = list(g.tobytes())
    bits = 0
    for r in range(8):
        for c in range(8):
            bits = (bits << 1) | (px[r * 9 + c] > px[r * 9 + c + 1])
    return bits


def prepare(image_dir: Path, provenance: Path, out: Path, min_side: int = 512,
            min_caption_words: int = 3, near_dup_bits: int = 4) -> dict:
    rows = {r["file"]: r for r in csv.DictReader(provenance.open(newline="", encoding="utf-8"))}
    out.mkdir(parents=True, exist_ok=True)
    accepted, rejected = [], []
    seen_sha: dict[str, str] = {}
    seen_dhash: list[tuple[int, str]] = []

    files = sorted(p for p in image_dir.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    for p in files:
        rel = str(p.relative_to(image_dir))

        def reject(reason: str):
            rejected.append({"file": rel, "reason": reason})

        row = rows.get(rel)
        if row is None:
            reject("no provenance row"); continue
        lic = (row.get("license") or "").strip().lower()
        if lic not in ALLOWED_LICENSES:
            reject(f"license not allowed: {lic or 'missing'}"); continue
        if not (row.get("source") or "").strip():
            reject("missing source"); continue
        caption = (row.get("caption") or "").strip()
        if len(caption.split()) < min_caption_words:
            reject("caption too short"); continue
        try:
            with Image.open(p) as im:
                im.verify()
            with Image.open(p) as im:
                im.load()
                w, h = im.size
                dh = dhash(im)
        except Exception as e:
            reject(f"corrupt: {type(e).__name__}"); continue
        if min(w, h) < min_side:
            reject(f"too small: {w}x{h}"); continue
        sha = hashlib.sha256(p.read_bytes()).hexdigest()
        if sha in seen_sha:
            reject(f"exact duplicate of {seen_sha[sha]}"); continue
        near = next((f for d, f in seen_dhash if bin(d ^ dh).count("1") <= near_dup_bits), None)
        if near:
            reject(f"near duplicate of {near}"); continue
        seen_sha[sha] = rel
        seen_dhash.append((dh, rel))
        accepted.append({"file_name": rel, "text": caption, "width": w, "height": h,
                         "sha256": sha, "source": row["source"].strip(), "license": lic})

    with (out / "metadata.jsonl").open("w", encoding="utf-8") as f:
        for a in accepted:
            f.write(json.dumps(a, ensure_ascii=False) + "\n")
    reasons: dict[str, int] = {}
    for r in rejected:
        k = r["reason"].split(":")[0].split(" of ")[0]
        reasons[k] = reasons.get(k, 0) + 1
    report = {"scanned": len(files), "accepted": len(accepted), "rejected": len(rejected),
              "rejections_by_reason": reasons, "rejected_files": rejected}
    (out / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("image_dir", type=Path)
    ap.add_argument("provenance", type=Path)
    ap.add_argument("--out", type=Path, default=Path("dataset"))
    ap.add_argument("--min-side", type=int, default=512)
    a = ap.parse_args()
    rep = prepare(a.image_dir, a.provenance, a.out, a.min_side)
    print(json.dumps({k: v for k, v in rep.items() if k != "rejected_files"}, indent=2))
