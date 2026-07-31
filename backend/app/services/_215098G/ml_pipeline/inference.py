"""Inference from an exported classifier bundle.

The training pipeline builds its feature matrix by horizontally stacking one
block per entry in the config's `features` list, in config order. That assembly
is the one step that has to be reproduced exactly at serving time, so this
module drives it from the bundle's recorded block order and reuses the same
builders as training.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

import joblib
import numpy as np
import scipy.sparse as sp

from .features import edit_structure_matrix


def load_bundle(settings) -> dict[str, Any]:
    artifact_paths = [
        settings.m2_model_path,
        settings.m2_vectorizer_path,
        settings.m2_scaler_path,
        settings.m2_label_encoder_path,
    ]
    missing_paths = [path for path in artifact_paths if not Path(path).exists()]
    if missing_paths:
        missing = ", ".join(str(path) for path in missing_paths)
        raise FileNotFoundError(f"Missing Module 2 artifacts: {missing}")

    model = joblib.load(settings.m2_model_path)
    vectorizer = joblib.load(settings.m2_vectorizer_path)
    scaler = joblib.load(settings.m2_scaler_path)
    label_encoder = joblib.load(settings.m2_label_encoder_path)

    return {
        "feature_order": ["tfidf_5k", "edit_structure"],
        "feature_types": {"tfidf_5k": "tfidf", "edit_structure": "edit_structure"},
        "vectorizers": {"tfidf_5k": vectorizer},
        "scalers": {"edit_structure": scaler},
        "model": model,
        "label_classes": list(label_encoder.classes_),
        "combine_strategy": "concat_columns",
        "text_separator": " [SEP] ",
    }


def _combine_text(
    before: Sequence[str], after: Sequence[str], bundle: dict[str, Any]
) -> np.ndarray:
    strategy = bundle.get("combine_strategy", "concat_columns")
    sep = bundle.get("text_separator", " [SEP] ")
    if strategy == "concat_columns":
        return np.array([f"{b}{sep}{a}" for b, a in zip(before, after)], dtype=object)
    if strategy == "before_only":
        return np.array(list(before), dtype=object)
    if strategy == "after_only":
        return np.array(list(after), dtype=object)
    raise ValueError(f"Unsupported combine_strategy: {strategy}")


def _normalize_text(values: Sequence[Any]) -> list[str]:
    return ["" if value is None else str(value) for value in values]


def assemble_features(
    bundle: dict[str, Any], before_text: Sequence[Any], after_text: Sequence[Any]
) -> sp.csr_matrix:
    """Build the model's input matrix from raw before/after edit text."""
    before = _normalize_text(before_text)
    after = _normalize_text(after_text)
    if len(before) != len(after):
        raise ValueError(
            f"before_text and after_text must be the same length ({len(before)} != {len(after)})"
        )

    blocks: list[sp.csr_matrix] = []
    for name in bundle["feature_order"]:
        block_type = bundle["feature_types"][name]
        if block_type == "tfidf":
            vectorizer = bundle["vectorizers"][name]
            blocks.append(vectorizer.transform(_combine_text(before, after, bundle)))
        elif block_type == "edit_structure":
            scaler = bundle["scalers"][name]
            blocks.append(edit_structure_matrix(before, after, scaler))
        else:
            raise ValueError(
                f"Feature block '{name}' has type '{block_type}', which this bundle format does not support at inference time."
            )

    if len(blocks) == 1:
        return blocks[0]
    return sp.hstack(blocks).tocsr()


def predict(
    bundle: dict[str, Any],
    before_text: Sequence[Any],
    after_text: Sequence[Any],
    **_: Any,
) -> np.ndarray:
    """Predict writing-stage names for each before/after pair."""
    X = assemble_features(bundle, before_text, after_text)
    y_pred = np.asarray(bundle["model"].predict(X))
    if y_pred.dtype.kind in {"U", "S"}:
        return y_pred
    if y_pred.dtype.kind == "O" and y_pred.size and isinstance(y_pred[0], str):
        return y_pred
    return np.asarray(bundle["label_classes"])[np.asarray(y_pred, dtype=int)]


def predict_proba(
    bundle: dict[str, Any],
    before_text: Sequence[Any],
    after_text: Sequence[Any],
    **_: Any,
) -> np.ndarray:
    """Class probabilities, column order matching bundle["label_classes"]."""
    X = assemble_features(bundle, before_text, after_text)
    return bundle["model"].predict_proba(X)
