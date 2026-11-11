import json
import sys
from pathlib import Path

import pytest
import torch
from safetensors.torch import load_file, save_file

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from expo import extrapolate_full, extrapolate_lora  # noqa: E402


def write_ckpt(d: Path, tensors: dict, sharded: bool):
    d.mkdir(parents=True)
    (d / "config.json").write_text(json.dumps({"model_type": "toy"}))
    (d / "tokenizer.json").write_text("{}")
    if not sharded:
        save_file(tensors, d / "model.safetensors")
        return
    names = sorted(tensors)
    half = len(names) // 2
    shards = {"model-00001-of-00002.safetensors": names[:half], "model-00002-of-00002.safetensors": names[half:]}
    wm = {}
    for shard, ns in shards.items():
        save_file({n: tensors[n] for n in ns}, d / shard)
        wm.update({n: shard for n in ns})
    (d / "model.safetensors.index.json").write_text(json.dumps({"metadata": {}, "weight_map": wm}))


@pytest.mark.parametrize("sharded", [False, True])
def test_full_extrapolation_math_and_dtype(tmp_path, sharded):
    g = torch.Generator().manual_seed(0)
    base = {"a.weight": torch.randn(4, 3, generator=g), "b.weight": torch.randn(5, generator=g).bfloat16(),
            "c.ids": torch.arange(3)}
    ft = {"a.weight": base["a.weight"] + 0.5, "b.weight": (base["b.weight"].float() - 1).bfloat16(),
          "c.ids": torch.arange(3), "extra.weight": torch.ones(2)}
    write_ckpt(tmp_path / "base", base, sharded)
    write_ckpt(tmp_path / "ft", ft, sharded)
    s = extrapolate_full(tmp_path / "base", tmp_path / "ft", tmp_path / "out", alpha=0.5)
    out = {}
    for f in (tmp_path / "out").glob("*.safetensors"):
        out.update(load_file(f))
    assert torch.allclose(out["a.weight"], base["a.weight"] + 0.75, atol=1e-6)  # 0.5 * 1.5
    assert out["b.weight"].dtype == torch.bfloat16
    assert torch.allclose(out["b.weight"].float(), base["b.weight"].float() - 1.5, atol=2e-2)
    assert torch.equal(out["c.ids"], torch.arange(3))          # integer tensor copied
    assert torch.equal(out["extra.weight"], torch.ones(2))     # not in base: copied
    assert s["missing_in_base"] == ["extra.weight"]
    assert json.loads((tmp_path / "out" / "config.json").read_text())["expo"]["alpha"] == 0.5
    assert (tmp_path / "out" / "tokenizer.json").exists()


def test_alpha_zero_is_identity(tmp_path):
    base = {"w": torch.randn(3, 3)}
    ft = {"w": base["w"] * 2}
    write_ckpt(tmp_path / "base", base, False)
    write_ckpt(tmp_path / "ft", ft, False)
    extrapolate_full(tmp_path / "base", tmp_path / "ft", tmp_path / "out", alpha=0.0)
    assert torch.equal(load_file(tmp_path / "out" / "model.safetensors")["w"], ft["w"])


def test_lora_scaling_equals_full_extrapolation(tmp_path):
    # The LoRA path must give the same weights as extrapolating the merged model.
    torch.manual_seed(0)
    W, A, B = torch.randn(6, 4), torch.randn(2, 4), torch.randn(6, 2)
    r, lora_alpha, alpha = 2, 4, 0.3
    merged = W + B @ A * (lora_alpha / r)
    expo_full = merged + alpha * (merged - W)
    d = tmp_path / "adapter"; d.mkdir()
    (d / "adapter_config.json").write_text(json.dumps({"peft_type": "LORA", "r": r, "lora_alpha": lora_alpha,
                                                       "alpha_pattern": {"q_proj": 8}}))
    cfg = extrapolate_lora(d, tmp_path / "out", alpha)
    assert cfg["alpha_pattern"]["q_proj"] == pytest.approx(8 * 1.3)
    expo_lora = W + B @ A * (cfg["lora_alpha"] / r)
    assert torch.allclose(expo_lora, expo_full, atol=1e-5)


def test_negative_alpha_rejected(tmp_path):
    with pytest.raises(ValueError):
        extrapolate_full(tmp_path, tmp_path, tmp_path / "o", alpha=-0.1)
