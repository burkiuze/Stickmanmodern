# COBALT Image — research notes and base-model decision

Date: 2026-11-11. Sizes, licenses and gating below were read from each
model's Hugging Face repository metadata on that date. Quality claims are the
publishers' or third parties'; nothing in this table was benchmarked by us.

## Environment this milestone was built in

| | |
|---|---|
| GPU | none |
| CPU | 4 threads, Intel Xeon with AVX-512, AVX512-BF16 and AMX |
| RAM | 15 GB |
| Free disk | about 19 GB |

Consequence: no training of any kind is possible here, and inference is only
possible for models whose largest single component fits in about 9 GB.

## Candidates

| Model | License (repo metadata) | Gated | Transformer / UNet | Text encoder | Fit for COBALT Phase A |
|---|---|---|---|---|---|
| FLUX.2 [klein] 4B | apache-2.0 | no | 7.75 GB | 8.05 GB (Qwen3) | **Chosen.** Permissive, 4-step distilled, smallest modern rectified-flow transformer. |
| Z-Image-Turbo | apache-2.0 | no | 24.6 GB | 8.05 GB | Permissive, but the transformer does not fit this machine. Strong GPU alternative. |
| Qwen-Image | apache-2.0 | no | 40.9 GB | 16.6 GB | Permissive, far too large here; needs a 24 GB+ GPU even quantized. |
| Stable Diffusion 3.5 Medium | stabilityai-ai-community | yes | 4.9 GB | three encoders | Custom license with revenue terms, gated. Rejected for redistribution risk. |
| FLUX.2 [dev], FLUX.2 [klein] 9B | non-commercial | — | — | — | Rejected: non-commercial. |
| SSD-1B / Segmind Vega | apache-2.0 | no | 4.5–8 GB | CLIP ×2 | Permissive and light, but 2023-generation SDXL distillations with weak text rendering and prompt adherence. |
| Sana Sprint 0.6B | apache-2.0 (repo) | no | 1.2 GB | 5.2 GB (Gemma) | Very fast; the Gemma encoder carries its own terms that need review before redistribution. |

## Decision

**COBALT Image v0.1 uses the unmodified FLUX.2 [klein] 4B weights.**

Reasons:
1. Apache-2.0 on every component in the repository, not gated.
2. Rectified-flow transformer with an LLM text encoder: the same family of
   design as the current leading open-weight models.
3. Distilled to 4 steps, so it is the only current-generation candidate that
   can produce an image on a CPU in minutes instead of hours.
4. 13 GB VRAM class according to its model card, so later fine-tuning is
   feasible on a single consumer or rented GPU.

What this decision does not give us: any COBALT-specific weights. v0.1 is a
pipeline, API and tooling around a third-party model.

## Component and license register

| Component | Source | License | Modified |
|---|---|---|---|
| Transformer, VAE, scheduler config | black-forest-labs/FLUX.2-klein-4B | apache-2.0 | no |
| Text encoder and tokenizer (Qwen3) | shipped in the same repository | apache-2.0 | no |
| diffusers, transformers, huggingface_hub, peft, accelerate | Hugging Face | apache-2.0 | no |
| PyTorch | PyTorch Foundation | BSD-3-Clause | no |
| FastAPI / Pydantic / Uvicorn | respective authors | MIT / MIT / BSD-3-Clause | no |
| CLIP ViT-B/32 (evaluation only) | openai/clip-vit-base-patch32 | MIT | no |
| Training data | none yet | — | — |
