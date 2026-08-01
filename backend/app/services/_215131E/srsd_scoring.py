from pathlib import Path

import torch
from sentence_transformers import SentenceTransformer

from app.services._215131E.srsd_model import RubricScorer


class SrsdScorer:
    """
    Serves the RubricScorer checkpoint trained by scripts/train_srsd_model.py.
    Loads the embedder and model weights once (at app startup), so scoring a
    request is just an embed + forward pass, not a fresh model load.
    """

    def __init__(self, embedding_model: str, checkpoint_path: Path):
        self._embedder = SentenceTransformer(embedding_model)
        self._model = RubricScorer(input_dim=self._embedder.get_embedding_dimension())
        state_dict = torch.load(checkpoint_path, map_location="cpu")
        self._model.load_state_dict(state_dict)
        self._model.eval()

    def score_organization(self, text: str) -> float:
        """Returns a 0-100 organization score for the given text."""
        embedding = self._embedder.encode(
            [text], convert_to_numpy=True, normalize_embeddings=True
        )
        with torch.no_grad():
            tensor = torch.tensor(embedding, dtype=torch.float32)
            raw_score = self._model(tensor).item()

        # Dataset labels are on a 1-10 scale (see it_content_scoring_dataset.md).
        clamped = max(1.0, min(10.0, raw_score))
        return round(clamped / 10 * 100)
