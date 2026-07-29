from dataclasses import dataclass

from app.core.config import Settings
from app.services._215043K.evaluator import Module4Evaluator
from app.services._215043K.q_table_store import QTableStore
from app.services._215043K.retriever import FeedbackRetriever
from app.services._215043K.rl_agent import ACTIONS, N_STATES, RLAgent
from app.services._215043K.session_store import SessionStore


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


def build_feedback_engine(settings: Settings) -> FeedbackEngine:
    """
    Called once at startup. Embedding the 50 knowledge base entries and the 44 strategy
    examples, and reading back the Q-table, all happen here so no request pays for them.
    """
    return FeedbackEngine(
        retriever=FeedbackRetriever(
            embedding_model=settings.feedback_embedding_model,
            kb_path=settings.feedback_kb_path,
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
            seed=settings.feedback_rl_seed,
        ),
        evaluator=Module4Evaluator(
            base_url=settings.module4_base_url,
            path=settings.module4_evaluate_path,
            timeout_seconds=settings.module4_timeout_seconds,
        ),
        sessions=SessionStore(
            path=settings.feedback_sessions_path,
            history_limit=settings.feedback_session_history_limit,
        ),
    )
