import logging
from pathlib import Path

import joblib
import pandas as pd
import spacy
import xgboost as xgb
from sentence_transformers import SentenceTransformer

from app.services._215051H.clarity_features import extract_features

logger = logging.getLogger(__name__)

_SPACY_MODEL = "en_core_web_sm"


class ClarityModelNotTrainedError(Exception):
    """Raised when clarity_model.json / clarity_calibrator.joblib aren't in place yet."""


class ClarityScorer:
    """
    Serves the XGBoost clarity model + isotonic calibrator trained by the
    (not-yet-written) backend/scripts/215051H/train_clarity_model.py, following
    module_04_feedback_scoring_final_flow_v2.py Cells 7-11.

    The XGBoost model is loaded via its native save_model()/load_model() format
    (clarity_model.json), not joblib/pickle -- XGBoost's own docs warn that
    pickling a Booster's raw serialize buffer isn't guaranteed portable across
    different builds/machines (e.g. Colab's build vs. a local build), even when
    both report the same version string; that's what caused an
    "input stream corrupted" error the first time this was wired up with
    joblib.dump(). The isotonic calibrator is a plain scikit-learn object with
    no such issue, so it still round-trips through joblib.

    spaCy / the semantic embedder / LanguageTool are loaded once at construction
    (same "pay the cost once at startup" pattern as SrsdScorer), but the
    checkpoint is loaded defensively: since it doesn't exist yet, a missing file
    must not crash the whole app at startup -- it leaves the scorer "not ready"
    and callers get a clear error instead.
    """

    def __init__(self, semantic_model: str, model_dir: Path):
        self._nlp = spacy.load(_SPACY_MODEL)
        self._semantic_model = SentenceTransformer(semantic_model)
        self._language_tool = self._load_language_tool()
        self._model, self._calibrator = self._load_checkpoint(model_dir)

    @staticmethod
    def _load_language_tool():
        try:
            import language_tool_python

            return language_tool_python.LanguageTool("en-US")
        except Exception:
            logger.warning(
                "LanguageTool unavailable (needs a local Java runtime) -- "
                "clarity scoring will report as not ready until it can load.",
                exc_info=True,
            )
            return None

    @staticmethod
    def _load_checkpoint(model_dir: Path):
        model_path = model_dir / "clarity_model.json"
        calibrator_path = model_dir / "clarity_calibrator.joblib"
        if not model_path.exists() or not calibrator_path.exists():
            logger.warning(
                "Clarity model checkpoint not found in %s -- feedback scoring will "
                "return 503 until clarity_model.json and clarity_calibrator.joblib "
                "are placed there.",
                model_dir,
            )
            return None, None
        model = xgb.XGBRegressor()
        model.load_model(str(model_path))
        calibrator = joblib.load(calibrator_path)
        return model, calibrator

    @property
    def is_ready(self) -> bool:
        return self._model is not None and self._calibrator is not None and self._language_tool is not None

    def predict_clarity(self, feedback_text: str) -> tuple[float, str, dict]:
        """Returns (score 0.0-1.0, reasoning, raw features), matching predict_clarity() in the notebook."""
        if not self.is_ready:
            raise ClarityModelNotTrainedError(
                "Clarity model not yet trained -- place clarity_model.json and "
                "clarity_calibrator.joblib in backend/app/data/215051H/clarity_model/."
            )

        features = extract_features(feedback_text, self._nlp, self._semantic_model, self._language_tool)
        raw = float(self._model.predict(pd.DataFrame([features]))[0])
        calibrated = float(self._calibrator.predict([raw])[0])
        score = max(0.0, min(1.0, calibrated / 100.0))  # model was trained on a 0-100 scale

        total_errors = features["grammar_errors"] + features["spelling_errors"] + features["punctuation_errors"]
        parts = [
            f"{total_errors} grammar/spelling/punctuation issue(s)",
            f"avg sentence length {features['avg_sentence_length']:.1f} tokens",
            f"readability (Flesch) {features['readability']:.0f}",
            f"specificity ratio {features['specificity_ratio']:.2f}",
        ]
        if features["hedge_word_count"] > 0:
            parts.append(f"{features['hedge_word_count']} hedge word(s) detected")
        if features["semantic_consistency"] < 0.4:
            parts.append("low semantic consistency between sentences")
        reasoning = (
            "Scored by the trained XGBoost clarity model + isotonic calibration "
            "(surface + syntax + semantic + specificity features): " + "; ".join(parts) + "."
        )
        return score, reasoning, features
