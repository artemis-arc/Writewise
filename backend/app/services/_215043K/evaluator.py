from dataclasses import dataclass

from app.core.config import Settings
from app.models._215051H.schemas import DimensionScore, FeedbackScoringRequest
from app.services._215043K.rl_agent import METRICS
from app.services._215051H.clarity_scoring import (
    ClarityModelNotTrainedError,
    ClarityScorer,
)
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215051H.feedback_scoring import StageContextSource, evaluate_feedback


class Module4UnavailableError(RuntimeError):
    """Module 4 could not produce the six scores this turn needs."""


@dataclass(frozen=True)
class EvaluationResult:
    """
    Both views of one Module 4 pass: `scores` is the plain float dict the RL state/reward
    math (get_state_id, is_fully_banded, agent.learn) already expects, and `dimensions` is
    the same six measures with their reasoning text kept, for anyone who wants to see why
    a score landed where it did (e.g. surfacing it to the browser console).
    """

    scores: dict[str, float]
    dimensions: dict[str, DimensionScore]


class Module4Evaluator:
    """
    Scores a generated piece of feedback on the six WRFEF measures by running Module 4.

    In the notebook this was module4_evaluate(), a stub returning six constants -- which
    is why every episode in the notebook's evaluation run scored the identical reward and
    the Q-table never learned anything. Pointing it at the real scorer is what turns the
    RL half of this module from scaffolding into something that trains.

    Module 4 is called in process rather than over HTTP. It ships inside this same app, so
    a POST to /api/v1/feedback-scoring would be the server calling itself: two extra round
    trips per turn, a base URL that has to stay correct in every deployment, and -- because
    that route is `async def` around blocking Gemini work -- each call would stall the event
    loop for the whole app.

    The stage and draft the feedback was generated from are sent as previous_stage and
    previous_content. Before, nothing was sent and evaluate_feedback() resolved all four
    context fields from Module 2's store -- but that store keeps moving. A turn runs up to
    four Gemini calls and the editor reclassifies on a 500ms debounce throughout, so by
    scoring time Module 2's `latest` was a newer draft, and sometimes a newer stage, than
    the one the feedback was actually written about. Sending them fixes that half: the
    position this feedback addresses is now stated rather than guessed at, and it is the
    same on both of a turn's two evaluations.

    current_stage and current_content are deliberately still left out, so
    fill_from_stage_context() supplies them from Module 2 and they mean what they say --
    where the student is now, as against where they were when the feedback was written.

    Two consequences follow from that, both intended. The WRFEF rubric asks about the
    learner's "current" writing problem and stage, so relevance and stage_alignment are
    graded against Module 2's live position rather than the pinned one, and can still
    differ between a turn's baseline and post-action evaluations. And a session Module 2
    has no record of -- any session at all after a restart, since StageContextStore is
    memory-only -- leaves current_stage unset, which evaluate_feedback() rejects outright:
    that surfaces as Module4UnavailableError and a 503 rather than a degraded score.
    """

    def __init__(
        self,
        retriever: FeedbackRetriever,
        clarity_scorer: ClarityScorer,
        settings: Settings,
        stage_context: StageContextSource | None = None,
    ):
        self._retriever = retriever
        self._clarity_scorer = clarity_scorer
        self._settings = settings
        self._stage_context = stage_context

    def evaluate(
        self,
        feedback: str,
        feedback_history: list[str],
        session_id: str,
        stage: str,
        content: str,
    ) -> dict[str, float]:
        """`stage` and `content` are the ones the feedback was generated from."""
        try:
            response = evaluate_feedback(
                FeedbackScoringRequest(
                    session_id=session_id,
                    given_feedback=feedback,
                    feedback_history=feedback_history,
                    # The position this feedback was written about, which by the time it
                    # is scored is the one the student has already moved on from.
                    previous_stage=stage,
                    previous_content=content,
                    # current_stage/current_content are deliberately not sent, so
                    # evaluate_feedback() fills them from Module 2 -- see the class
                    # docstring for what that buys and what it costs.
                ),
                self._retriever,
                self._clarity_scorer,
                self._settings,
                session_id=session_id,
                # Required, not optional: current_stage/current_content are left out of
                # the payload above precisely so this fills them, and evaluate_feedback()
                # raises on an unset current_stage.
                stage_context=self._stage_context,
            )
        # MissingWritingContextError subclasses ValueError, so it is covered here too. The
        # agent cannot pick an action without all six scores, and a Q-update without them
        # would poison the table -- so every failure mode fails the turn rather than
        # degrading it.
        except (ClarityModelNotTrainedError, KeyError, ValueError, TypeError) as exc:
            raise Module4UnavailableError(
                f"Module 4 could not score this feedback: {exc}"
            ) from exc

        # No validation or clamping needed: FeedbackScoringResponse declares all six
        # measures required and ge=0/le=1, so Pydantic has already guaranteed the shape.
        dimensions = {metric: getattr(response.dimensions, metric) for metric in METRICS}
        scores = {metric: dimensions[metric].score for metric in METRICS}
        return EvaluationResult(scores=scores, dimensions=dimensions)
