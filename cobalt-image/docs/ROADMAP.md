# Roadmap

Status words: **done** = built and tested in this repository; **untested** =
written but never run; **not started**.

## Phase A — foundation (this milestone)

| Item | Status |
|---|---|
| Environment inspection, model research, decision record | done — `docs/RESEARCH.md` |
| Inference engine with GPU and low-memory CPU modes | done — `cobalt/engine.py` |
| CLI | done — `cobalt/cli.py` |
| HTTP API: generations, job status, models, health, API keys, rate limit, queue, usage | done — `api/server.py`, 14 tests |
| Dataset preparation: provenance, license allow-list, corruption, size, exact and near duplicates | done — `training/prepare_dataset.py`, 1 test |
| Evaluation harness with fixed seeds and CLIP score | done — `eval/run_eval.py` |
| Hugging Face publication, verified by downloading the repo and generating from it | done — https://huggingface.co/burkiuzeai/cobalt-image (revision a768e9c) |
| Baseline evaluation, 8 prompts at 512 px | done — `eval/results/baseline_512` |
| LoRA fine-tuning launcher | untested — `training/train_lora.sh` needs a GPU |
| Next.js frontend | not started |
| Docker, PostgreSQL, Redis, object storage | not started |
| GenEval / T2I-CompBench, comparison against other models | not started |
| Aesthetic scoring and caption-quality scoring in data prep | not started |
| Upscaling / tiled decoding for 2K–4K | not started |

## Phase B — COBALT adaptation (needs a GPU with 24 GB+ VRAM)

1. Assemble a licensed image-caption set and run it through `prepare_dataset.py`.
2. Train a LoRA on the klein transformer; register it in `cobalt/config.py`
   with `weights_origin="cobalt-finetune"`.
3. Re-run `eval/run_eval.py` on base and fine-tune with the same seeds and
   publish both columns.

The first model that may honestly be called a COBALT fine-tune ships here.

## Phase C — advanced model

Sampler and schedule experiments, a refinement / super-resolution stage,
prompt-enhancement as an explicit opt-in step. Each only ships if the
evaluation shows a gain.

## Phase D — independent foundation model

Training a competitive multi-billion-parameter text-to-image model from
scratch takes on the order of hundreds of millions of licensed image-caption
pairs and thousands of GPU-days. It is out of reach of a single machine and
is listed here as a direction, not a schedule.
