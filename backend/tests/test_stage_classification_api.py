import os
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient
from scipy.sparse import csr_matrix

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from app import main as main_module
from app.api.routes._215098G import stage_classification as stage_route


class _FakeVectorizer:
    def transform(self, texts):
        return csr_matrix(np.ones((len(texts), 3)))


class _FakeScaler:
    def transform(self, values):
        return csr_matrix(np.ones((values.shape[0], 20)))


class _FakeModel:
    def __init__(self, predict_result, proba_result):
        self._predict_result = predict_result
        self._proba_result = proba_result

    def predict(self, features):
        return self._predict_result

    def predict_proba(self, features):
        return self._proba_result


def _fake_settings():
    return SimpleNamespace(
        embedding_model="test-embedding",
        scenarios_path=main_module.get_settings().scenarios_path,
        srsd_embedding_model="test-srsd-embedding",
        srsd_checkpoint_path=main_module.get_settings().srsd_checkpoint_path,
        feedback_embedding_model="test-feedback-embedding",
        feedback_kb_path=main_module.get_settings().feedback_kb_path,
        clarity_semantic_model="test-clarity-model",
        clarity_model_dir=main_module.get_settings().clarity_model_dir,
        cors_origins=["http://localhost:3000"],
        m2_model_path=main_module.get_settings().m2_model_path,
        m2_vectorizer_path=main_module.get_settings().m2_vectorizer_path,
        m2_scaler_path=main_module.get_settings().m2_scaler_path,
        m2_label_encoder_path=main_module.get_settings().m2_label_encoder_path,
    )


@pytest.fixture(autouse=True)
def _stub_startup_dependencies(monkeypatch):
    fake_settings = _fake_settings()
    monkeypatch.setattr(main_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(
        main_module, "ScenarioRetriever", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(main_module, "SrsdScorer", lambda *args, **kwargs: object())
    monkeypatch.setattr(
        main_module, "build_feedback_engine", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(
        main_module, "FeedbackRetriever", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(main_module, "ClarityScorer", lambda *args, **kwargs: object())
    yield


@pytest.fixture
def client():
    with TestClient(main_module.app) as test_client:
        yield test_client


def _patch_stage_bundle(monkeypatch, predict_result, proba_result):
    bundle = {
        "feature_order": ["tfidf_5k", "edit_structure"],
        "feature_types": {"tfidf_5k": "tfidf", "edit_structure": "edit_structure"},
        "vectorizers": {"tfidf_5k": _FakeVectorizer()},
        "scalers": {"edit_structure": _FakeScaler()},
        "model": _FakeModel(predict_result, proba_result),
        "label_classes": ["Planning", "Implementation", "Revision"],
        "combine_strategy": "concat_columns",
        "text_separator": " [SEP] ",
    }
    monkeypatch.setattr(main_module, "load_stage_bundle", lambda settings: bundle)
    return bundle


def test_stage_classification_success(monkeypatch):
    _patch_stage_bundle(
        monkeypatch,
        predict_result=["Planning"],
        proba_result=np.array([[0.05, 0.7, 0.25]]),
    )

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/v1/stage-classification",
            json={
                "before_text": "Draft outline",
                "after_text": "Draft outline with sources",
                "timestamp": 123.45,
            },
        )

    assert response.status_code == 200
    assert response.json() == {"stage": "Planning", "confidence": 0.7}


def test_stage_classification_missing_artifacts_returns_503(monkeypatch):
    monkeypatch.setattr(
        main_module,
        "load_stage_bundle",
        lambda settings: (_ for _ in ()).throw(
            FileNotFoundError("Missing Module 2 artifacts: model.joblib")
        ),
    )

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/v1/stage-classification",
            json={
                "before_text": "Draft outline",
                "after_text": "Draft outline with sources",
                "timestamp": 123.45,
            },
        )

    assert response.status_code == 503
    assert "Missing Module 2 artifacts" in response.json()["detail"]


def test_stage_classification_batch_success(monkeypatch):
    _patch_stage_bundle(
        monkeypatch,
        predict_result=["Planning"],
        proba_result=np.array([[0.05, 0.7, 0.25]]),
    )

    def fake_predict(bundle, before_texts, after_texts, timestamps=None):
        if timestamps == [1.0]:
            return ["Planning"]
        if timestamps == [2.0]:
            return ["Revision"]
        return ["Planning"]

    def fake_predict_proba(bundle, before_texts, after_texts, timestamps=None):
        if timestamps == [1.0]:
            return np.array([[0.05, 0.7, 0.25]])
        if timestamps == [2.0]:
            return np.array([[0.1, 0.2, 0.7]])
        return np.array([[0.05, 0.7, 0.25]])

    monkeypatch.setattr(stage_route, "predict", fake_predict)
    monkeypatch.setattr(stage_route, "predict_proba", fake_predict_proba)

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/v1/stage-classification/batch",
            json={
                "events": [
                    {
                        "before_text": "Draft outline",
                        "after_text": "Draft outline with sources",
                        "timestamp": 1.0,
                    },
                    {
                        "before_text": "Draft outline with sources",
                        "after_text": "Draft outline with sources and edits",
                        "timestamp": 2.0,
                    },
                ],
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "events": [
            {"stage": "Planning", "confidence": 0.7},
            {"stage": "Revision", "confidence": 0.7},
        ],
        "latest": {"stage": "Revision", "confidence": 0.7},
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"before_text": "Draft outline", "timestamp": 123.45},
        {
            "before_text": "Draft outline",
            "after_text": "Draft outline with sources",
            "timestamp": "bad",
        },
    ],
)
def test_stage_classification_invalid_payload_returns_422(monkeypatch, payload):
    _patch_stage_bundle(
        monkeypatch,
        predict_result=["Planning"],
        proba_result=np.array([[0.05, 0.7, 0.25]]),
    )

    with TestClient(main_module.app) as client:
        response = client.post("/api/v1/stage-classification", json=payload)

    assert response.status_code == 422
    assert "detail" in response.json()


@pytest.mark.parametrize(
    "predict_result, proba_result",
    [
        ([], np.array([[0.05, 0.7, 0.25]])),
        (["Planning"], np.array([[]])),
    ],
)
def test_stage_classification_unexpected_model_shapes_return_502(
    monkeypatch, predict_result, proba_result
):
    _patch_stage_bundle(
        monkeypatch, predict_result=predict_result, proba_result=proba_result
    )

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/v1/stage-classification",
            json={
                "before_text": "Draft outline",
                "after_text": "Draft outline with sources",
                "timestamp": 123.45,
            },
        )

    assert response.status_code == 502
    assert response.json()["detail"].startswith(
        "Model response did not match the expected shape"
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"events": []},
        {
            "events": [
                {
                    "before_text": "Draft outline",
                    "after_text": "Draft outline with sources",
                }
            ]
        },
    ],
)
def test_stage_classification_batch_invalid_payload_returns_422(monkeypatch, payload):
    _patch_stage_bundle(
        monkeypatch,
        predict_result=["Planning"],
        proba_result=np.array([[0.05, 0.7, 0.25]]),
    )

    with TestClient(main_module.app) as client:
        response = client.post("/api/v1/stage-classification/batch", json=payload)

    assert response.status_code == 422
