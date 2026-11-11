# Experiments

## 1. Prompt enhancement with the pipeline's own text encoder (2026-11-11)

**Idea.** The text encoder is a Qwen3 causal LM. Before encoding, let it
rewrite a short prompt into a detailed one. No extra model or download.

**Setup.** Four short prompts ("a cat", "a futuristic city", "a cup of coffee
on a table", "a knight fighting a dragon"), 512×512, 4 steps, seed 42, CPU.
Each generated twice: raw prompt, enhanced prompt.
Image: `docs/samples/enhance_before_after_512.jpg` (top row raw, bottom row enhanced).

**Observed.**
- All four enhanced images have more specific lighting, setting and detail
  than the raw ones. This is a judgement from looking at four pairs, not a
  measured score, and no blind comparison was done.
- Cost: about 33 s extra per image on a 4-thread CPU (LLM generation).
- First version of the instructions made the model invent named characters
  in quotes for the knight prompt. The instructions were tightened (no names
  of people, characters, brands, artists or works; quotes only for text the
  request asks for) and the retest produced none. One retest with requested
  text ("OPEN" on a cafe sign) kept the word and rendered it correctly.

**Decision.** Kept as an opt-in feature (`enhance=True`, `--enhance`). Off by
default because it changes what the user asked for and adds latency.

**Not done.** No metric-based evaluation, no test on long prompts (skipped
above 40 words by design), no test in languages other than English.
