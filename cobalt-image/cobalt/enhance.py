"""Optional prompt enhancement.

The base pipeline's text encoder is a Qwen3 causal language model, so it can
also *write*. COBALT reuses it to expand a short prompt into a detailed one
before encoding: no extra model, no extra download, no network call.

It is opt-in, and the engine always returns both the original and the
rewritten prompt so nothing is changed behind the user's back.
"""
from __future__ import annotations

import torch

SYSTEM = (
    "You rewrite short image requests into one detailed image description for a "
    "text-to-image model. Keep the subject, the count of objects and every stated "
    "detail exactly as given. Add concrete visual information that was left out: "
    "setting, lighting, materials and textures, colours, composition and camera or "
    "art style. Any text that should appear in the image stays in double quotes. "
    "Do not invent extra subjects. Write a single paragraph of at most 90 words. "
    "Output only the description."
)

# Prompts already this long are left alone: they carry their own detail, and
# rewriting risks dropping some of it.
SKIP_ABOVE_WORDS = 40


@torch.inference_mode()
def enhance_prompt(text_encoder, tokenizer, prompt: str, max_new_tokens: int = 160) -> str:
    if len(prompt.split()) > SKIP_ABOVE_WORDS:
        return prompt
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]
    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    inputs = tokenizer(text, return_tensors="pt").to(text_encoder.device)
    out = text_encoder.generate(
        **inputs, max_new_tokens=max_new_tokens, do_sample=False,
        repetition_penalty=1.05, pad_token_id=tokenizer.eos_token_id)
    new = tokenizer.decode(out[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    new = " ".join(new.split())
    # The model sometimes wraps its whole answer in quotes. Quoted text means
    # "render these words in the image", so strip a pair that encloses everything.
    if len(new) > 1 and new[0] == new[-1] == '"' and '"' not in new[1:-1]:
        new = new[1:-1].strip()
    # Fall back to the original if the model returned nothing usable.
    return new if len(new.split()) >= 5 else prompt
