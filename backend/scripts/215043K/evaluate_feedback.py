"""
Reproduces the offline evaluation from Feedback_Generation_Module.ipynb against the
served pipeline, so the numbers in the write-up describe the code that actually ships
rather than a notebook that has drifted from it.

Each of the 30 cases is scored the way the notebook scored them: best-of-N semantic
similarity against the expected feedbacks, ROUGE-L on the same best match, and a
0.8/0.2 blend of the two. The mean Module 4 reward is reported alongside, because that
is the number that says whether the RL half has anything to learn from.

Run from backend/:
    .venv\\Scripts\\python.exe scripts\\215043K\\evaluate_feedback.py --stub-evaluator

--stub-evaluator swaps in the constants the notebook's module4_evaluate() returned. It
exists to reproduce the notebook's baseline; those constants score a reward of -1 on
every case, so a run with it tells you nothing about the agent. Drop the flag once
Module 4 is reachable.

Needs one extra package the API itself does not:  pip install rouge-score
"""
import argparse
import json
import statistics
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Must precede anything that pulls in torch. faiss and torch each ship their own OpenMP
# runtime, and on Windows whichever loads second fails with WinError 1114 while trying
# to initialise c10.dll. app.main happens to get this right because it imports a
# retriever before the SRSD scorer; a standalone script has to say so explicitly.
import faiss  # noqa: F401,E402  -- imported for DLL load order, not for its API

from sentence_transformers import SentenceTransformer  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.services._215043K.engine import FeedbackEngine
from app.services._215043K.evaluator import Module4Evaluator
from app.services._215043K.pipeline import generate_feedback
from app.services._215043K.q_table_store import QTableStore
from app.services._215043K.retriever import FeedbackRetriever
from app.services._215043K.rl_agent import ACTIONS, METRICS, N_STATES, RLAgent, calculate_reward
from app.services._215043K.session_store import SessionStore

HERE = Path(__file__).resolve().parent
EVALUATION_SET_PATH = HERE / "evaluation_set.json"

SEMANTIC_WEIGHT = 0.8
ROUGE_WEIGHT = 0.2

# What module4_evaluate() returned in the notebook, kept only so --stub-evaluator can
# reproduce that run exactly. These six numbers are why it reported a reward of -1.0000.
NOTEBOOK_STUB_SCORES = {
    "relevance": 0.82,
    "clarity": 0.45,
    "actionability": 0.61,
    "stage_alignment": 0.38,
    "improvement_impact": 0.74,
    "consistency_with_history": 0.55,
}


class _StubEvaluator:
    def evaluate(self, feedback, stage, content, feedback_history):
        return dict(NOTEBOOK_STUB_SCORES)


class TextScorer:
    """Semantic similarity + ROUGE-L against whichever expected feedback matches best."""

    def __init__(self, embedding_model: str):
        try:
            from rouge_score import rouge_scorer
        except ImportError as exc:
            raise SystemExit(
                "evaluate_feedback.py needs the rouge-score package: pip install rouge-score"
            ) from exc

        self._embedder = SentenceTransformer(embedding_model)
        self._rouge = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)

    def score(self, prediction: str, references: list[str]) -> dict[str, float]:
        import numpy as np

        prediction_embedding = self._embedder.encode([prediction])[0]
        reference_embeddings = self._embedder.encode(references)

        similarities = reference_embeddings @ prediction_embedding / (
            np.linalg.norm(reference_embeddings, axis=1) * np.linalg.norm(prediction_embedding)
        )
        best = int(np.argmax(similarities))

        semantic = float(similarities[best])
        rouge = self._rouge.score(references[best], prediction)["rougeL"].fmeasure
        return {
            "semantic_similarity": semantic,
            "rouge_l": rouge,
            "final_score": SEMANTIC_WEIGHT * semantic + ROUGE_WEIGHT * rouge,
        }


def build_engine(settings, args) -> FeedbackEngine:
    # Deliberately not the paths the API serves from: an evaluation run updates the
    # Q-table on every case, and that learning should not land in the live table.
    return FeedbackEngine(
        retriever=FeedbackRetriever(
            settings.feedback_embedding_model,
            settings.feedback_gen_kb_path,
            settings.feedback_strategy_kb_path,
        ),
        agent=RLAgent(
            store=QTableStore(args.q_table, N_STATES, len(ACTIONS)),
            alpha=settings.feedback_alpha,
            gamma=settings.feedback_gamma,
            epsilon=settings.feedback_epsilon,
            seed=args.seed,
        ),
        evaluator=_StubEvaluator()
        if args.stub_evaluator
        else Module4Evaluator(
            settings.module4_base_url,
            settings.module4_evaluate_path,
            settings.module4_timeout_seconds,
        ),
        sessions=SessionStore(args.sessions, settings.feedback_session_history_limit),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stub-evaluator", action="store_true",
                        help="use the notebook's constant Module 4 scores instead of the service")
    parser.add_argument("--delay", type=float, default=15.0,
                        help="seconds between cases, to stay inside Gemini's rate limit")
    parser.add_argument("--retries", type=int, default=3, help="attempts per case before skipping")
    parser.add_argument("--limit", type=int, help="run only the first N cases (for a quick check)")
    parser.add_argument("--seed", type=int, default=42, help="seed for epsilon-greedy exploration")
    parser.add_argument("--q-table", type=Path, default=HERE / "eval_q_table.json")
    parser.add_argument("--sessions", type=Path, default=HERE / "eval_sessions.json")
    parser.add_argument("--out", type=Path, default=HERE / "evaluation_results.json")
    args = parser.parse_args()

    settings = get_settings()
    cases = json.loads(EVALUATION_SET_PATH.read_text(encoding="utf-8"))
    if args.limit:
        cases = cases[: args.limit]
    print(f"Loaded {len(cases)} evaluation cases")

    engine = build_engine(settings, args)
    scorer = TextScorer(settings.feedback_embedding_model)

    results = []
    for index, case in enumerate(cases, start=1):
        query = case["input_query"]
        profile = query["profile_context"]
        references = case.get("expected_feedbacks") or [case["expected_feedback"]]

        for attempt in range(1, args.retries + 1):
            try:
                result = generate_feedback(
                    # A session per case, so no case inherits another's history -- the
                    # notebook had no history at all, and this keeps cases independent.
                    session_id=f"eval-{case['id']}",
                    stage=query["stage"],
                    writer_level=profile["writer_level"],
                    content=query["content"],
                    mechanics=profile["mechanics"],
                    vocabulary=profile["vocabulary"],
                    organization=profile["organization"],
                    engine=engine,
                    settings=settings,
                )
                break
            except Exception as exc:  # noqa: BLE001 - a rate limit should not end the run
                print(f"  {case['id']} attempt {attempt}/{args.retries} failed: {exc}")
                if attempt == args.retries:
                    result = None
                else:
                    time.sleep(60)

        if result is None:
            print(f"SKIPPED: {case['id']}")
            continue

        text_scores = scorer.score(result.feedback, references)
        results.append({
            "id": case["id"],
            "stage": result.stage,
            "writer_level": result.writer_level,
            "generated_feedback": result.feedback,
            "action": result.action,
            "used_rl_action": result.used_rl_action,
            "module4_reward": calculate_reward(result.scores),
            **text_scores,
        })
        print(f"[{index}/{len(cases)}] {case['id']} | score {text_scores['final_score']:.4f} "
              f"| reward {results[-1]['module4_reward']:+d} | {result.action}")

        if index < len(cases):
            time.sleep(args.delay)

    if not results:
        raise SystemExit("No cases completed.")

    args.out.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    report(results, args.out)


def report(results: list[dict], out_path: Path) -> None:
    def mean(key: str) -> float:
        return statistics.fmean(row[key] for row in results)

    print(f"\nCompleted {len(results)} cases")
    print(f"Semantic Similarity : {mean('semantic_similarity'):.4f}")
    print(f"ROUGE-L             : {mean('rouge_l'):.4f}")
    print(f"Final Score         : {mean('final_score'):.4f}")
    print(f"Avg Module4 Reward  : {mean('module4_reward'):.4f}")
    print(f"RL action taken on  : {sum(r['used_rl_action'] for r in results)}/{len(results)} cases")

    print("\nBy stage:")
    for stage in sorted({row["stage"] for row in results}):
        rows = [row for row in results if row["stage"] == stage]
        print(f"  {stage:15} n={len(rows):2}  "
              f"final={statistics.fmean(r['final_score'] for r in rows):.4f}  "
              f"reward={statistics.fmean(r['module4_reward'] for r in rows):+.4f}")

    print(f"\nPer-case results written to {out_path}")


if __name__ == "__main__":
    main()
