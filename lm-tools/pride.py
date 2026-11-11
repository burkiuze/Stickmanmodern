"""PriDe: debias multiple-choice answers for COBALT / Xona evaluation.

Method: Zheng et al., "Large Language Models Are Not Robust Multiple Choice
Selectors", ICLR 2024. Independent implementation from the paper's
description; no code from the authors' repository (it has no licence).

LLMs prefer some option IDs ("A", "B"...) regardless of content. PriDe
estimates that prior on a small subset of questions by cyclically permuting
the option contents, then removes it from every prediction:

    P_debiased(option i | q)  ∝  P_observed(ID d_i | q) / P_prior(ID d_i)

The model is passed in as a function, so this works with any backend
(llama.cpp, transformers, an API).

    score_fn(question: str, options: list[str]) -> list[float]
        probabilities (or unnormalised scores >= 0) over option IDs, in order.
"""
from __future__ import annotations

import math
from typing import Callable, Sequence

ScoreFn = Callable[[str, Sequence[str]], Sequence[float]]


def _normalise(p: Sequence[float]) -> list[float]:
    s = float(sum(p))
    if s <= 0 or any(x < 0 for x in p):
        raise ValueError(f"scores must be non-negative with a positive sum, got {list(p)}")
    return [x / s for x in p]


def estimate_prior(score_fn: ScoreFn, samples: Sequence[tuple[str, Sequence[str]]]) -> list[float]:
    """Prior over option IDs, from cyclic permutations of each sample's options.

    For one question, averaging log P(ID) over all cyclic shifts cancels the
    content (every option sits under every ID once) and leaves the ID bias.
    """
    if not samples:
        raise ValueError("need at least one sample")
    k = len(samples[0][1])
    total = [0.0] * k
    for q, opts in samples:
        if len(opts) != k:
            raise ValueError("all samples must have the same number of options")
        logs = [0.0] * k
        for shift in range(k):
            perm = list(opts[shift:]) + list(opts[:shift])
            p = _normalise(score_fn(q, perm))
            for i in range(k):
                logs[i] += math.log(max(p[i], 1e-12))
        # softmax of mean log-prob per ID = this question's prior estimate
        m = [l / k for l in logs]
        mx = max(m)
        e = [math.exp(x - mx) for x in m]
        z = sum(e)
        for i in range(k):
            total[i] += e[i] / z
    return [t / len(samples) for t in total]


def debias(probs: Sequence[float], prior: Sequence[float]) -> list[float]:
    p = _normalise(probs)
    if len(p) != len(prior):
        raise ValueError("probs and prior differ in length")
    return _normalise([pi / max(qi, 1e-12) for pi, qi in zip(p, prior)])


def evaluate(score_fn: ScoreFn, items: Sequence[tuple[str, Sequence[str], int]],
             prior_fraction: float = 0.05, min_prior_samples: int = 5) -> dict:
    """Accuracy before and after PriDe. items: (question, options, correct_index).

    The first prior_fraction of items (at least min_prior_samples) are used
    to estimate the prior; accuracy is reported on the remaining items only,
    so the estimation set never scores itself.
    """
    n_prior = max(min_prior_samples, int(len(items) * prior_fraction))
    if n_prior >= len(items):
        raise ValueError("not enough items left to evaluate after estimating the prior")
    prior = estimate_prior(score_fn, [(q, o) for q, o, _ in items[:n_prior]])
    rest = items[n_prior:]
    raw = deb = 0
    for q, opts, gold in rest:
        p = score_fn(q, opts)
        raw += max(range(len(p)), key=lambda i: p[i]) == gold
        d = debias(p, prior)
        deb += max(range(len(d)), key=lambda i: d[i]) == gold
    return {"prior": prior, "n_prior": n_prior, "n_eval": len(rest),
            "accuracy_raw": raw / len(rest), "accuracy_pride": deb / len(rest)}
