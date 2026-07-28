import json
from pathlib import Path
from typing import Any

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


def _format_document(doc: dict[str, Any]) -> str:
    profile = doc["writing_profile"]
    return f"""
Scenario ID: {doc['id']}
Job: {doc['task']}
Academic Level: {doc['academic_level']}
Writer Level: {profile['writer_level']}

Conditions:
Mechanics Range: {profile['mechanics_range']}
Vocabulary Range: {profile['vocabulary_range']}
Organization Range: {profile['organization_range']}

Task Breakdown:
{doc['task_breakdown']}

Actions:
{doc['actions']}
"""


class ScenarioRetriever:
    """
    Re-implements task_define.ipynb's retrieval step: embed the 10 pedagogical
    scenarios once, then for each query retrieve the top-k semantic matches and
    re-rank them with an academic-level bonus (same formula as the notebook).
    Building the index once here (at app startup) instead of per-request is the
    one deliberate change from the notebook, which rebuilt it inline every run.
    """

    def __init__(self, embedding_model: str, scenarios_path: Path):
        self._documents: list[dict[str, Any]] = json.loads(
            scenarios_path.read_text(encoding="utf-8")
        )
        self._embedder = SentenceTransformer(embedding_model)

        corpus = [_format_document(doc) for doc in self._documents]
        embeddings = self._embedder.encode(corpus)
        self._index = faiss.IndexFlatL2(embeddings.shape[1])
        self._index.add(np.array(embeddings))

    def retrieve_best_match(self, query: str, academic_level: str) -> dict[str, Any]:
        query_embedding = self._embedder.encode([query])
        k = min(5, len(self._documents))
        distances, indices = self._index.search(np.array(query_embedding), k)

        candidates = [self._documents[i] for i in indices[0]]
        semantic_scores = 1.0 / (1.0 + distances[0])
        level_bonus = np.array(
            [1.2 if doc.get("academic_level") == academic_level else 0.8 for doc in candidates]
        )
        combined_scores = semantic_scores * level_bonus

        best_idx = int(np.argmax(combined_scores)) if len(combined_scores) else 0
        return candidates[best_idx]
