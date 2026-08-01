"""Legacy model classes required to unpickle exported Module 2 artifacts.

The saved joblib classifier stores its estimator inside a small wrapper object
that was originally defined under the top-level `ml_pipeline.models` module.
This compatibility module preserves that import path so the artifact can be
loaded without retraining or rewriting the pickle payload.
"""

from __future__ import annotations

from typing import Any

import scipy.sparse as sp


class TreeModelWrapper:
    """Delegate predictions to the wrapped estimator stored in the pickle."""

    def _prepare_features(self, X: Any):
        if sp.issparse(X):
            return X.toarray()
        return X

    def predict(self, X: Any):
        return self._model.predict(self._prepare_features(X))

    def predict_proba(self, X: Any):
        return self._model.predict_proba(self._prepare_features(X))

    def __getattr__(self, name: str):
        if name.startswith("__"):
            raise AttributeError(name)
        model = self.__dict__.get("_model")
        if model is None:
            raise AttributeError(name)
        return getattr(model, name)
