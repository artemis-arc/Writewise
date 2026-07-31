from __future__ import annotations

from typing import Any, Sequence

import numpy as np
import scipy.sparse as sp
from sklearn.preprocessing import StandardScaler


def _common_prefix_suffix_len(before: str, after: str) -> int:
    min_len = min(len(before), len(after))
    prefix = 0
    while prefix < min_len and before[prefix] == after[prefix]:
        prefix += 1
    suffix = 0
    while suffix < (min_len - prefix) and before[-1 - suffix] == after[-1 - suffix]:
        suffix += 1
    return prefix + suffix


def _edit_structure_row(before: Any, after: Any) -> tuple[list[float], list[float]]:
    before_str = "" if before is None else str(before)
    after_str = "" if after is None else str(after)
    common = _common_prefix_suffix_len(before_str, after_str)
    insertion_len = max(0, len(after_str) - common)
    deletion_len = max(0, len(before_str) - common)
    net_change = len(after_str) - len(before_str)

    numeric = [float(insertion_len), float(deletion_len), float(net_change)]
    one_hot = [0.0, 0.0, 0.0, 0.0]

    if insertion_len > 0 and deletion_len == 0:
        one_hot[0] = 1.0
    elif deletion_len > 0 and insertion_len == 0:
        one_hot[1] = 1.0
    elif insertion_len > 0 and deletion_len > 0:
        one_hot[2] = 1.0
    else:
        one_hot[3] = 1.0

    return numeric, one_hot


def _edit_structure_matrix(
    before_text: np.ndarray,
    after_text: np.ndarray,
    scaler: StandardScaler | None,
    fit_scaler: bool,
) -> tuple[sp.csr_matrix, StandardScaler]:
    n_rows = len(before_text)
    numeric = np.zeros((n_rows, 3), dtype=float)
    one_hot = np.zeros((n_rows, 4), dtype=float)

    for i, (before, after) in enumerate(zip(before_text, after_text)):
        numeric_row, one_hot_row = _edit_structure_row(before, after)
        numeric[i] = numeric_row
        one_hot[i] = one_hot_row

    if fit_scaler:
        scaler = StandardScaler()
        numeric = scaler.fit_transform(numeric)
    else:
        if scaler is None:
            raise ValueError("Scaler is required when fit_scaler is False")
        numeric = scaler.transform(numeric)

    features = np.hstack([numeric, one_hot])
    return sp.csr_matrix(features), scaler


def edit_structure_matrix(
    before_text: Sequence[Any], after_text: Sequence[Any], scaler: StandardScaler
):
    """Inference-time edit-structure features using an already-fitted scaler."""
    X, _ = _edit_structure_matrix(
        np.asarray(before_text, dtype=object),
        np.asarray(after_text, dtype=object),
        scaler,
        fit_scaler=False,
    )
    return X
