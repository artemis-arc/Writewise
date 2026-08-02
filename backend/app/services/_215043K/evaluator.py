import asyncio

from app.core.config import Settings
from app.models._215051H.schemas import FeedbackScoringRequest
from app.services._215043K.rl_agent import METRICS
from app.services._215051H.clarity_scoring import ClarityModelNotTrainedError, ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215051H.feedback_scoring import StageContextSource, evaluate_feedback


class Module4UnavailableError(RuntimeError):
    """Module 4 could not produce the six scores this turn needs."""


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

    Only the feedback and the session's history are sent, because they are the only two
    things this module owns. Module 4 resolves the stage and draft from Module 2's store
    itself, so neither module carries the other's data around.
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

    def evaluate(self, feedback: str, feedback_history: list[str]) -> dict[str, float]:
        try:
            # evaluate_feedback is `async def` but never awaits anything: its Gemini call
            # and its clarity model are both blocking. Driving it with a private loop on
            # this thread keeps that blocking where it already is -- on a threadpool
            # worker -- instead of handing it to the loop serving every other request.
            response = asyncio.run(
                evaluate_feedback(
                    FeedbackScoringRequest(
                        given_feedback=feedback, feedback_history=feedback_history
                    ),
                    self._retriever,
                    self._clarity_scorer,
                    self._settings,
                    stage_context=self._stage_context,
                )
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
        return {metric: getattr(response.dimensions, metric).score for metric in METRICS}
