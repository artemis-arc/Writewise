"""Compatibility package for pickled Module 2 artifacts.

The exported M2 joblib files reference the historical top-level `ml_pipeline`
package path. This shim keeps those artifacts loadable while the actual source
lives under `app.services._215098G.ml_pipeline`.
"""

from .models import TreeModelWrapper
from app.services._215098G.ml_pipeline.features import edit_structure_matrix
from app.services._215098G.ml_pipeline.inference import (
    assemble_features,
    load_bundle,
    predict,
    predict_proba,
)

__all__ = [
    "assemble_features",
    "edit_structure_matrix",
    "load_bundle",
    "predict",
    "predict_proba",
    "TreeModelWrapper",
]
