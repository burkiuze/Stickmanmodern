---
license: apache-2.0
pipeline_tag: text-to-image
library_name: diffusers
base_model: black-forest-labs/FLUX.2-klein-4B
language:
- en
tags:
- text-to-image
- diffusers
- flux2
- rectified-flow
- cobalt-image
---

# COBALT Image

COBALT Image is a text-to-image pipeline from COBALT AI.

> **Lineage, stated plainly.** Version 0.1 contains the **unmodified weights of
> [FLUX.2 [klein] 4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)
> by Black Forest Labs**, redistributed under the Apache License 2.0. COBALT AI
> has not trained or fine-tuned these weights. Image quality is that of
> FLUX.2 [klein] 4B. COBALT AI is not affiliated with or endorsed by Black
> Forest Labs.

What COBALT AI adds in v0.1 is around the model, not inside it: an inference
engine with a low-memory mode that runs without a GPU, an HTTP API, a dataset
preparation tool and an evaluation harness. Fine-tuned COBALT weights are
planned (see Roadmap) and will be published as a separate, clearly labelled
revision.

| | |
|---|---|
| Version | 0.1 (Phase A) |
| Weights origin | third-party, unmodified |
| Base model | `black-forest-labs/FLUX.2-klein-4B` |
| Architecture | rectified-flow transformer (about 4B parameters), Qwen3 text encoder, FLUX.2 VAE |
| Sampling | 4 steps, guidance 1.0 (step-distilled) |
| License | Apache-2.0 |

## Usage

```bash
pip install -U diffusers transformers accelerate torch
```

```python
import torch
from diffusers import Flux2KleinPipeline

pipe = Flux2KleinPipeline.from_pretrained("__REPO__", torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()   # or pipe.to("cuda") with enough VRAM

image = pipe(
    prompt="A red fox sitting in a snowy forest at sunrise, photograph",
    width=1024, height=1024,
    num_inference_steps=4, guidance_scale=1.0,
    generator=torch.Generator("cpu").manual_seed(1),
).images[0]
image.save("cobalt.png")
```

Width and height must be multiples of 16.

## Hardware

| Setup | Status |
|---|---|
| GPU with about 13 GB VRAM | Stated by the base model's card. **Not tested by COBALT AI.** |
| CPU only, 15 GB RAM, 4 threads (AVX-512 / AMX) | **Tested.** 512×512 in about 56 s, peak memory 9.0 GB, using the staged mode in the COBALT engine (text encoder and transformer are never loaded together). |

## Evaluation

__EVAL__

## Intended use

Generating images from English text prompts for creative, design, research
and product work, including commercial use as the license allows.

## Out-of-scope use

Do not use this model to:

- create sexual content involving minors, or non-consensual intimate imagery;
- create content that is unlawful, defamatory, harassing or that incites violence;
- impersonate real people or produce deceptive content presented as authentic;
- generate or spread disinformation;
- infringe the copyright, trademark or publicity rights of others.

You are responsible for what you generate and for complying with the law
where you operate.

## Limitations

- Everything the base model gets wrong, this version gets wrong too: hands
  and fine anatomy, exact object counts, long or small text, and complex
  spatial relations can fail.
- Prompts are expected in English.
- Outputs can reflect biases in the base model's training data, which COBALT
  AI did not select and cannot audit.
- No safety filter or watermark is applied by this repository. The base
  model's publisher describes filters and provenance tools in its own
  inference code; deployers should add their own input/output filtering.
- No native 2K/4K pipeline, inpainting or outpainting in this version.

## Training data

COBALT AI used no training data: the weights are unmodified. For the data
and safety mitigations behind the base weights, see the
[FLUX.2 [klein] 4B model card](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B).

## Files

| Path | Origin |
|---|---|
| `transformer/`, `vae/`, `text_encoder/`, `tokenizer/`, `scheduler/`, `model_index.json` | FLUX.2 [klein] 4B, unchanged |
| `LICENSE` | Apache License 2.0 |
| `NOTICE` | attribution and trademark notice |
| `README.md`, `samples/` | COBALT AI |

## Roadmap

1. **Phase A (this release):** working pipeline on a permissively licensed base.
2. **Phase B:** LoRA fine-tune on a licensed, provenance-tracked dataset; first weights that may be called a COBALT fine-tune.
3. **Phase C:** sampling and refinement improvements, shipped only with measured gains.
4. **Phase D:** independently trained weights. A long-term direction, not a scheduled release.

## License and attribution

Apache License 2.0. See `LICENSE` and `NOTICE`. FLUX.2 [klein] 4B is
© Black Forest Labs. "FLUX" and "Black Forest Labs" are trademarks of their
owner and are used here only to identify the base model.
