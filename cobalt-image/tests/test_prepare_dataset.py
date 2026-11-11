import csv
import json
import random
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
from prepare_dataset import prepare  # noqa: E402


def noise(path, size=(600, 600), seed=0):
    rnd = random.Random(seed)
    small = Image.new("RGB", (16, 16))
    small.putdata([(rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)) for _ in range(256)])
    small.resize(size, Image.BICUBIC).save(path)


def test_prepare_filters(tmp_path):
    d = tmp_path / "img"; d.mkdir()
    noise(d / "good.png", seed=1)
    noise(d / "good2.png", seed=2)
    (d / "z_exact.png").write_bytes((d / "good.png").read_bytes())
    Image.open(d / "good2.png").save(d / "near.jpg", quality=90)
    noise(d / "small.png", size=(200, 200), seed=3)
    noise(d / "nolicense.png", seed=4)
    noise(d / "norow.png", seed=5)
    noise(d / "shortcap.png", seed=6)
    (d / "corrupt.png").write_bytes(b"not an image")
    rows = [
        ("good.png", "a colourful abstract pattern", "own camera", "own-work"),
        ("good2.png", "another abstract colour field", "own camera", "cc0-1.0"),
        ("z_exact.png", "a colourful abstract pattern", "own camera", "own-work"),
        ("near.jpg", "another abstract colour field", "own camera", "cc0-1.0"),
        ("small.png", "a small abstract pattern", "own camera", "own-work"),
        ("nolicense.png", "an abstract pattern again", "the web", "all-rights-reserved"),
        ("shortcap.png", "pattern", "own camera", "own-work"),
        ("corrupt.png", "a broken image file", "own camera", "own-work"),
    ]
    prov = tmp_path / "prov.csv"
    with prov.open("w", newline="") as f:
        w = csv.writer(f); w.writerow(["file", "caption", "source", "license"]); w.writerows(rows)

    rep = prepare(d, prov, tmp_path / "out")
    kept = [json.loads(l)["file_name"] for l in (tmp_path / "out" / "metadata.jsonl").read_text().splitlines()]
    assert kept == ["good.png", "good2.png"]
    why = {r["file"]: r["reason"] for r in rep["rejected_files"]}
    assert why["z_exact.png"].startswith("exact duplicate")
    assert why["near.jpg"].startswith("near duplicate")
    assert why["small.png"].startswith("too small")
    assert why["nolicense.png"].startswith("license not allowed")
    assert why["norow.png"] == "no provenance row"
    assert why["shortcap.png"] == "caption too short"
    assert why["corrupt.png"].startswith("corrupt")
    assert rep["scanned"] == 9 and rep["accepted"] == 2
