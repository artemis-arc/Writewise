from dataclasses import dataclass

from app.core.config import Settings
from app.services._215043K.evaluator import Module4Evaluator
from app.services._215043K.q_table_store import QTableStore
from app.services._215043K.retriever import FeedbackRetriever
from app.services._215043K.rl_agent import ACTIONS, N_STATES, RLAgent
from app.services._215043K.session_store import SessionStore
from app.services._215051H.clarity_scoring import ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever as Module4Retriever
from app.services._215051H.feedback_scoring import StageContextSource


@dataclass(frozen=True)
class FeedbackEngine:
    """
    The four long-lived pieces of the feedback module, bundled so main.py's lifespan
    builds them in one call and the router reaches them through one dependency.
    """

    retriever: FeedbackRetriever
    agent: RLAgent
    evaluator: Module4Evaluator
    sessions: SessionStore


def build_feedback_engine(
    settings: Settings,
    module4_retriever: Module4Retriever,
    clarity_scorer: ClarityScorer,
    stage_context: StageContextSource | None = None,
) -> FeedbackEngine:
    """
    Called once at startup. Embedding the 50 knowledge base entries and the 44 strategy
    examples, and reading back the Q-table, all happen here so no request pays for them.

    Module 4's retriever and clarity scorer are built by the same lifespan and passed in
    rather than rebuilt here -- both load a sentence-transformer, and the evaluator wants
    the very same objects the /api/v1/feedback-scoring route serves from.
    """
    return FeedbackEngine(
        retriever=FeedbackRetriever(
            embedding_model=settings.feedback_embedding_model,
            kb_path=settings.feedback_gen_kb_path,
            strategy_kb_path=settings.feedback_strategy_kb_path,
        ),
        agent=RLAgent(
            store=QTableStore(
                path=settings.feedback_q_table_path,
                n_states=N_STATES,
                n_actions=len(ACTIONS),
            ),
            alpha=settings.feedback_alpha,
            gamma=settings.feedback_gamma,
            epsilon=settings.feedback_epsilon,
            reward_lambda=settings.feedback_reward_lambda,
            seed=settings.feedback_rl_seed,
        ),
        evaluator=Module4Evaluator(
            retriever=module4_retriever,
            clarity_scorer=clarity_scorer,
            settings=settings,
            stage_context=stage_context,
        ),
        sessions=SessionStore(
            path=settings.feedback_sessions_path,
            history_limit=settings.feedback_session_history_limit,
        ),
    )
