from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from app.services._215051H.feedback_kb import build_document_corpus, load_kb


class FeedbackRetriever:
    """
    Re-implements module_04_feedback_scoring_final_flow_v2.py's RAG retrieval step
    (Cells 12-13): embed the KB document corpus once, then for each query retrieve
    the top-k semantic matches. Building the index once here (at app startup)
    instead of per-request is the one deliberate change from the notebook, same
    as ScenarioRetriever does for the task-breakdown module.
    """

    def __init__(self, embedding_model: str, kb_path: Path):
        kb = load_kb(kb_path)
        self._documents = build_document_corpus(kb)
        self._embedder = SentenceTransformer(embedding_model)

        embeddings = self._embedder.encode(self._documents)
        self._index = faiss.IndexFlatL2(embeddings.shape[1])
        self._index.add(np.array(embeddings))

    def retrieve(self, query: str, k: int = 6) -> list[str]:
        query_embedding = self._embedder.encode([query])
        top_k = min(k, len(self._documents))
        _distances, indices = self._index.search(np.array(query_embedding), top_k)
        return [self._documents[i] for i in indices[0]]
