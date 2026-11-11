"""Model extrapolation (ExPO) for COBALT and Xona fine-tunes.

Method: Zheng et al., "Model Extrapolation Expedites Alignment", ACL 2025.
This is an independent implementation written from the paper's description;
no code from the authors' repository is used (that repository has no licence).

Given a base model and a fine-tuned model, move one step further along the
direction the fine-tune took:

    theta_expo = theta_ft + alpha * (theta_ft - theta_base)

alpha = 0 returns the fine-tune unchanged. The method only helps when the
fine-tune moved the model in a good direction: if fine-tuning made the model
worse, extrapolation makes it worse still. Always pick alpha with an eval.

Two entry points:

* extrapolate_lora  - the fine-tune is a PEFT LoRA adapter. Its weight delta is
  B @ A * (lora_alpha / r) (or / sqrt(r) with rsLoRA), linear in lora_alpha,
  so ExPO is exactly "multiply lora_alpha by (1 + alpha)". Instant, tiny.
* extrapolate_full  - both are full checkpoints in safetensors. Streams one
  tensor at a time, so peak memory is about two tensors, not two models.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import torch
from safetensors import safe_open
from safetensors.torch import save_file


def extrapolate_lora(adapter_dir: str | Path, out_dir: str | Path, alpha: float) -> dict:
    adapter_dir, out_dir = Path(adapter_dir), Path(out_dir)
    if alpha < 0:
        raise ValueError("alpha must be >= 0")
    cfg_path = adapter_dir / "adapter_config.json"
    cfg = json.loads(cfg_path.read_text())
    if cfg.get("peft_type", "LORA").upper() != "LORA":
        raise ValueError(f"not a LoRA adapter: peft_type={cfg.get('peft_type')}")
    if out_dir.resolve() != adapter_dir.resolve():
        shutil.copytree(adapter_dir, out_dir, dirs_exist_ok=True)
    factor = 1.0 + alpha
    cfg["lora_alpha"] = cfg["lora_alpha"] * factor
    # Per-module overrides scale the same way.
    if cfg.get("alpha_pattern"):
        cfg["alpha_pattern"] = {k: v * factor for k, v in cfg["alpha_pattern"].items()}
    cfg["expo"] = {"alpha": alpha, "method": "Zheng et al. 2025, ACL (ExPO)"}
    (out_dir / "adapter_config.json").write_text(json.dumps(cfg, indent=2))
    return cfg


def _index(model_dir: Path) -> dict[str, str]:
    """tensor name -> shard filename"""
    idx = model_dir / "model.safetensors.index.json"
    if idx.exists():
        return json.loads(idx.read_text())["weight_map"]
    single = model_dir / "model.safetensors"
    if not single.exists():
        raise FileNotFoundError(f"no safetensors checkpoint in {model_dir}")
    with safe_open(single, "pt") as f:
        return {k: "model.safetensors" for k in f.keys()}


def extrapolate_full(base_dir: str | Path, ft_dir: str | Path, out_dir: str | Path, alpha: float,
                     skip: tuple[str, ...] = ()) -> dict:
    base_dir, ft_dir, out_dir = Path(base_dir), Path(ft_dir), Path(out_dir)
    if alpha < 0:
        raise ValueError("alpha must be >= 0")
    base_map, ft_map = _index(base_dir), _index(ft_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    # Copy config, tokenizer and anything else that is not a weight file.
    for p in ft_dir.iterdir():
        if p.is_file() and not p.name.endswith(".safetensors"):
            shutil.copy2(p, out_dir / p.name)

    stats = {"extrapolated": 0, "copied": 0, "missing_in_base": [], "shape_mismatch": []}
    by_shard: dict[str, list[str]] = {}
    for name, shard in ft_map.items():
        by_shard.setdefault(shard, []).append(name)

    for shard, names in sorted(by_shard.items()):
        out: dict[str, torch.Tensor] = {}
        with safe_open(ft_dir / shard, "pt") as ft:
            for name in names:
                t_ft = ft.get_tensor(name)
                if name not in base_map or any(s in name for s in skip):
                    if name not in base_map:
                        stats["missing_in_base"].append(name)
                    out[name] = t_ft
                    stats["copied"] += 1
                    continue
                with safe_open(base_dir / base_map[name], "pt") as b:
                    t_base = b.get_tensor(name)
                if t_base.shape != t_ft.shape:
                    stats["shape_mismatch"].append(name)
                    out[name] = t_ft
                    stats["copied"] += 1
                    continue
                if not t_ft.is_floating_point():
                    out[name] = t_ft
                    stats["copied"] += 1
                    continue
                # Compute in float32, store in the fine-tune's dtype.
                ft32, base32 = t_ft.float(), t_base.float()
                out[name] = (ft32 + alpha * (ft32 - base32)).to(t_ft.dtype).contiguous()
                stats["extrapolated"] += 1
        save_file(out, out_dir / shard, metadata={"format": "pt"})
        del out

    cfg_p = out_dir / "config.json"
    if cfg_p.exists():
        cfg = json.loads(cfg_p.read_text())
        cfg["expo"] = {"alpha": alpha, "base": str(base_dir), "method": "Zheng et al. 2025, ACL (ExPO)"}
        cfg_p.write_text(json.dumps(cfg, indent=2))
    return stats


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("lora", help="scale a LoRA adapter")
    l.add_argument("adapter_dir"); l.add_argument("out_dir"); l.add_argument("--alpha", type=float, required=True)
    f = sub.add_parser("full", help="extrapolate two full checkpoints")
    f.add_argument("base_dir"); f.add_argument("ft_dir"); f.add_argument("out_dir")
    f.add_argument("--alpha", type=float, required=True)
    f.add_argument("--skip", nargs="*", default=[], help="substrings of tensor names to copy unchanged")
    a = ap.parse_args()
    if a.cmd == "lora":
        print(json.dumps(extrapolate_lora(a.adapter_dir, a.out_dir, a.alpha), indent=2))
    else:
        s = extrapolate_full(a.base_dir, a.ft_dir, a.out_dir, a.alpha, tuple(a.skip))
        print(json.dumps({k: (v if isinstance(v, int) else len(v)) for k, v in s.items()}, indent=2))


if __name__ == "__main__":
    main()
