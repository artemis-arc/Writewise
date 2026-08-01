from dataclasses import dataclass

from app.core.config import Settings
from app.services._215043K.engine import FeedbackEngine
from app.services._215043K.gemini_client import generate_text
from app.services._215043K.prompt import build_prompt, format_query
from app.services._215043K.rl_agent import (
    ACTIONS,
    NO_ACTION_INDEX,
    get_state_id,
    is_fully_banded,
)


@dataclass(frozen=True)
class FeedbackResult:
    feedback: str
    stage: str
    writer_level: str
    scores: dict[str, float]
    reward: int
    action: str
    action_index: int
    baseline_state: int
    final_state: int
    strategies: list[str]
    used_rl_action: bool


def generate_feedback(
    session_id: str,
    stage: str,
    writer_level: str,
    content: str,
    mechanics: float,
    vocabulary: float,
    organization: float,
    engine: FeedbackEngine,
    settings: Settings,
) -> FeedbackResult:
    """
    One turn of get_final_feedback() from Feedback_Generation_Module.ipynb.

    Generate a baseline, have Module 4 score it, and read those six scores as the state.
    If the baseline is already strong on all six there is nothing to intervene on and it
    ships as-is; otherwise the agent picks an adaptation instruction and the feedback is
    regenerated and rescored. Either way the turn ends in a Q-update.

    That is four LLM round trips in the regenerate path, all on the request's critical
    path, which is deliberate -- it keeps the served pipeline identical to the one the
    notebook's evaluation numbers were measured on.
    """
    profile = {
        "writer_level": writer_level,
        "mechanics": mechanics,
        "vocabulary": vocabulary,
        "organization": organization,
    }
    history = engine.sessions.get(session_id).feedback_history

    # Retrieval depends only on the query, so the two prompts below share one pass. The
    # notebook re-ran retrieval and the strategy vote inside each get_prompt() call and
    # got the same documents back both times.
    retrieval = engine.retriever.retrieve(
        query=format_query(stage, content, profile),
        stage=stage,
        writer_level=writer_level,
    )

    def generate(action_instruction: str | None) -> str:
        return generate_text(
            build_prompt(
                stage=stage,
                content=content,
                profile=profile,
                retrieval=retrieval,
                action_instruction=action_instruction,
                feedback_history=history,
            ),
            settings,
        )

    def evaluate(feedback: str) -> dict[str, float]:
        # Module 4 resolves the stage and the draft from Module 2's store itself, so this
        # turn only hands over the two things it owns.
        return engine.evaluator.evaluate(feedback=feedback, feedback_history=history)

    # Baseline first, so the state the agent acts on describes this turn's actual
    # content rather than whatever the previous turn happened to leave behind.
    baseline_feedback = generate(None)
    baseline_scores = evaluate(baseline_feedback)
    baseline_state = get_state_id(stage, baseline_scores)

    if is_fully_banded(baseline_scores):
        action_index = NO_ACTION_INDEX
    else:
        action_index = engine.agent.select_action(baseline_state)

    if action_index == NO_ACTION_INDEX:
        # Either the baseline was already strong on all six measures, or the agent has
        # no evidence for this state yet and fell back to the no-op. Both mean there is
        # no instruction to add -- and build_prompt() renders the no-op as no action
        # block at all, so regenerating here would send Gemini the identical prompt and
        # re-score the identical thing. The notebook did exactly that, burning two of
        # its four calls on a round trip that could not change the outcome.
        final_feedback = baseline_feedback
        final_scores = baseline_scores
        final_state = baseline_state
        used_rl_action = False
    else:
        final_feedback = generate(ACTIONS[action_index])
        final_scores = evaluate(final_feedback)
        final_state = get_state_id(stage, final_scores)
        used_rl_action = True

    reward = engine.agent.learn(final_scores, baseline_state, action_index, final_state)
    engine.sessions.record_turn(session_id, final_feedback, final_state)

    return FeedbackResult(
        feedback=final_feedback,
        stage=stage,
        writer_level=writer_level,
        scores=final_scores,
        reward=reward,
        action=ACTIONS[action_index],
        action_index=action_index,
        baseline_state=baseline_state,
        final_state=final_state,
        strategies=[strategy["strategy_name"] for strategy in retrieval.strategies],
        used_rl_action=used_rl_action,
    )
