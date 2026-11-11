import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pride import debias, estimate_prior, evaluate  # noqa: E402

BIAS = [3.0, 1.0, 1.0, 1.0]  # a model that loves option "A"


def biased_model(q, opts):
    """Knows the answer weakly (content marked '*'), but prefers ID 0 strongly."""
    return [(2.0 if o.endswith("*") else 1.0) * BIAS[i] for i, o in enumerate(opts)]


def make_items(n, seed=0):
    rnd = random.Random(seed)
    items = []
    for j in range(n):
        gold = rnd.randrange(4)
        opts = [f"q{j}o{i}" + ("*" if i == gold else "") for i in range(4)]
        items.append((f"q{j}", opts, gold))
    return items


def test_prior_recovers_id_bias():
    prior = estimate_prior(biased_model, [(q, o) for q, o, _ in make_items(10)])
    want = [b / sum(BIAS) for b in BIAS]
    assert prior == pytest.approx(want, abs=1e-6)


def test_debias_removes_prior():
    assert debias([0.6, 0.2, 0.1, 0.1], [0.5, 0.25, 0.125, 0.125]) == pytest.approx([1.2 / 3.6, 0.8 / 3.6, 0.8 / 3.6, 0.8 / 3.6], abs=1e-9)


def test_evaluate_improves_accuracy_on_biased_model():
    r = evaluate(biased_model, make_items(400, seed=1))
    assert r["n_eval"] == 380
    assert r["accuracy_pride"] == pytest.approx(1.0)
    assert r["accuracy_raw"] < 0.5  # bias (3x) beats knowledge (2x) whenever gold is not "A"


def test_bad_scores_rejected():
    with pytest.raises(ValueError):
        debias([0, 0], [0.5, 0.5])
