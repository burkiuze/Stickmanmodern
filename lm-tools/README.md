# lm-tools

Post-training tools for the COBALT 4B and Xona Research language models.

| Tool | What it does | Method |
|---|---|---|
| `expo.py` | Model extrapolation: push a fine-tune one step further along the direction training moved it, with no extra training. Works on a LoRA adapter (instant) or two full checkpoints (streamed, low memory). | Zheng et al., *Model Extrapolation Expedites Alignment*, ACL 2025 |
| `pride.py` | Debiased multiple-choice evaluation: removes a model's preference for particular option letters before scoring. | Zheng et al., *Large Language Models Are Not Robust Multiple Choice Selectors*, ICLR 2024 |

Both are independent implementations written from the papers. The authors'
repositories (github.com/chujiezheng/LLM-Extrapolation, LLM-MCQ-Bias) carry no
licence, so none of their code is copied here.

## ExPO usage

```bash
# LoRA adapter from the fine-tune: scale it by (1 + alpha)
python expo.py lora path/to/adapter out/adapter-expo-0.3 --alpha 0.3

# Full checkpoints
python expo.py full path/to/Qwen3.5-4B path/to/finetuned out/expo-0.3 --alpha 0.3
```

Pick alpha by evaluation (e.g. `xona-research/eval`): try 0.1, 0.3, 0.5 and
keep alpha = 0 if none beats it. ExPO amplifies whatever the fine-tune did,
so it makes a fine-tune that hurt the model worse, not better.

## Tests

```bash
python -m pytest tests -q
```
