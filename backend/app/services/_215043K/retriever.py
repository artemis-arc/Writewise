import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

STAGES = ("PLANNING", "IMPLEMENTATION", "REVISION")

# Feedback_Generation_Module.ipynb retrieves exactly 4 examples, preferring the ones
# whose writer_level matches the student's and padding with the next-best regardless.
RETRIEVED_EXAMPLE_COUNT = 4

# A runner-up strategy is included when it trails the winner by at most this many votes.
STRATEGY_VOTE_GAP_THRESHOLD = 1


def format_kb_entry(entry: dict[str, Any]) -> str:
    """The document text that gets embedded and shown to the LLM as an example."""
    profile = entry["input"]["profile_context"]
    return f"""Stage: {entry['input']['stage']}
Writer Level: {profile['writer_level']}
Mechanics Score: {profile['mechanics']}
Vocabulary Score: {profile['vocabulary']}
Organization Score: {profile['organization']}
Content: {entry['input']['content']}
Feedback: {entry['output']['feedback']}"""


@dataclass(frozen=True)
class RetrievalResult:
    """What the prompt builder needs out of a retrieval pass."""

    documents: list[str]
    feedbacks: list[str]
    strategies: list[dict[str, Any]]


@dataclass
class _StageIndex:
    index: faiss.IndexFlatL2
    documents: list[str]
    feedbacks: list[str]
    writer_levels: list[str]


class FeedbackRetriever:
    """
    Ports the retrieval half of Feedback_Generation_Module.ipynb: one FAISS index per
    writing stage over the 50 feedback examples, then a vote over the 44 SRSD strategies
    to decide which pedagogical strategy the generated feedback should follow.

    The notebook rebuilt both the indexes and the strategy embeddings inline on every
    run. Here they are built once in __init__ so that -- as with ScenarioRetriever --
    the app pays the embedding cost at startup rather than on every request. The
    retrieval maths itself is unchanged.
    """

    def __init__(self, embedding_model: str, kb_path: Path, strategy_kb_path: Path):
        self._embedder = SentenceTransformer(embedding_model)

        kb: list[dict[str, Any]] = json.loads(kb_path.read_text(encoding="utf-8"))
        strategy_kb: list[dict[str, Any]] = json.loads(
            strategy_kb_path.read_text(encoding="utf-8")
        )

        self._stage_indexes = {stage: self._build_stage_index(kb, stage) for stage in STAGES}

        # Strategies are grouped by stage because a PLANNING strategy is never a valid
        # suggestion during REVISION -- the vote only ever runs within one stage.
        self._strategies_by_stage: dict[str, list[dict[str, Any]]] = {
            stage: [entry for entry in strategy_kb if entry["stage"] == stage] for stage in STAGES
        }
        self._strategy_embeddings: dict[str, np.ndarray] = {
            stage: self._encode([entry["feedback_example"] for entry in entries])
            for stage, entries in self._strategies_by_stage.items()
        }

    def _encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self._embedder.get_sentence_embedding_dimension()), dtype="float32")
        return np.asarray(self._embedder.encode(texts), dtype="float32")

    def _build_stage_index(self, kb: list[dict[str, Any]], stage: str) -> _StageIndex:
        entries = [entry for entry in kb if entry["input"]["stage"] == stage]
        documents = [format_kb_entry(entry) for entry in entries]

        embeddings = self._encode(documents)
        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(embeddings)

        return _StageIndex(
            index=index,
            documents=documents,
            feedbacks=[entry["output"]["feedback"] for entry in entries],
            writer_levels=[entry["input"]["profile_context"]["writer_level"] for entry in entries],
        )

    def retrieve(self, query: str, stage: str, writer_level: str) -> RetrievalResult:
        if stage not in self._stage_indexes:
            raise ValueError(f"Unknown writing stage {stage!r}; expected one of {STAGES}.")

        stage_index = self._stage_indexes[stage]
        query_embedding = self._encode([query])

        # Searching the whole stage bucket rather than top-k: the writer-level filter
        # below can reject most of the near neighbours, so a truncated search could
        # leave nothing at the student's level to choose from.
        _, indices = stage_index.index.search(query_embedding, len(stage_index.documents))
        ranked = [int(i) for i in indices[0]]

        selected = [i for i in ranked if stage_index.writer_levels[i] == writer_level]
        selected = selected[:RETRIEVED_EXAMPLE_COUNT]

        # Too few examples at this writer level -- top up with the closest matches from
        # any level rather than sending the model a thinner context than it expects.
        for i in ranked:
            if len(selected) >= RETRIEVED_EXAMPLE_COUNT:
                break
            if i not in selected:
                selected.append(i)

        documents = [stage_index.documents[i] for i in selected]
        feedbacks = [stage_index.feedbacks[i] for i in selected]

        return RetrievalResult(
            documents=documents,
            feedbacks=feedbacks,
            strategies=self._match_strategies(feedbacks, stage),
        )

    def _match_strategies(self, feedbacks: list[str], stage: str) -> list[dict[str, Any]]:
        """
        Each retrieved example's feedback votes for the strategy whose reference example
        it is closest to; the winner (plus a close runner-up) is what the prompt asks the
        model to apply. The notebook embedded each feedback in its own encode() call --
        this batches them, which changes nothing about the resulting cosine ranking.
        """
        candidates = self._strategies_by_stage[stage]
        if not candidates or not feedbacks:
            return []

        feedback_embeddings = self._encode(feedbacks)
        strategy_embeddings = self._strategy_embeddings[stage]

        similarities = _cosine_similarity(feedback_embeddings, strategy_embeddings)
        winners = similarities.argmax(axis=1)

        vote_counts: dict[str, int] = {}
        for strategy_idx in winners:
            name = candidates[int(strategy_idx)]["strategy_name"]
            vote_counts[name] = vote_counts.get(name, 0) + 1

        ranked = sorted(vote_counts.items(), key=lambda item: item[1], reverse=True)
        top_name, top_votes = ranked[0]
        selected_names = {top_name}

        if len(ranked) > 1:
            runner_up_name, runner_up_votes = ranked[1]
            if top_votes - runner_up_votes <= STRATEGY_VOTE_GAP_THRESHOLD:
                selected_names.add(runner_up_name)

        return [entry for entry in candidates if entry["strategy_name"] in selected_names]


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    """
    Pairwise cosine similarity, matching sklearn's cosine_similarity for these inputs
    without pulling sklearn into the request path.
    """
    left_norm = left / np.linalg.norm(left, axis=1, keepdims=True)
    right_norm = right / np.linalg.norm(right, axis=1, keepdims=True)
    return left_norm @ right_norm.T
