# Eval run — cobalt-image-v0.1

- Weights: `black-forest-labs/FLUX.2-klein-4B` (third-party)
- 512x512, 4 steps, guidance 1.0, seed 1234
- Device: cpu (staged mode), {'cuda': False, 'cpu_threads': 4, 'ram_gb': 15.7, 'vram_gb': None, 'gpu': None}
- Metric: CLIP score (openai/clip-vit-base-patch32) — prompt-agreement proxy only
- Prompts: 8 of the suite's 8

| id | category | CLIP score | seconds |
|---|---|---|---|
| photo_portrait | photorealism | 37.72 | 47.86 |
| hands | anatomy | 34.34 | 52.68 |
| count_apples | counting | 33.28 | 66.85 |
| spatial | spatial | 39.0 | 56.83 |
| text_sign | text | 38.37 | 78.77 |
| cinematic | cinematic | 36.43 | 79.58 |
| architecture | architecture | 38.54 | 104.12 |
| illustration | art | 43.39 | 88.22 |

Mean CLIP score: **37.63**

No comparison models were run, so this says nothing about relative quality.
