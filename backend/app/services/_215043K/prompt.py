from app.services._215043K.retriever import RetrievalResult

NO_ACTION = "No additional instruction"

# How many past turns of feedback are shown to the model. Enough for it to avoid
# repeating itself without crowding out the retrieved examples.
FEEDBACK_HISTORY_LIMIT = 3


def format_query(stage: str, content: str, profile: dict) -> str:
    """
    The string that gets embedded for retrieval -- profile plus the draft itself.

    Vocabulary is omitted rather than rendered as None when Module 1 (215131E) did not
    score it. With a value present the string is byte for byte what the notebook
    embedded, which is what keeps the evaluation numbers comparable.
    """
    segments = [
        f"Stage: {stage}",
        f"Writer Level: {profile['writer_level']}",
        f"Mechanics: {profile['mechanics']}",
    ]
    if profile.get("vocabulary") is not None:
        segments.append(f"Vocabulary: {profile['vocabulary']}")
    segments.append(f"Organization: {profile['organization']}")
    segments.append(f"Content: {content}")
    return " | ".join(segments)


def _profile_block(profile: dict) -> str:
    """
    The writer's half of the Student Context header.

    Same omission rule as format_query: a "Vocabulary Score: None/100" line reads to the
    model as a measurement, and when Module 1 skipped vocabulary there is none behind it.
    """
    lines = [
        f"- Writer Level: {profile['writer_level']}",
        f"- Mechanics Score: {profile['mechanics']}/100",
    ]
    if profile.get("vocabulary") is not None:
        lines.append(f"- Vocabulary Score: {profile['vocabulary']}/100")
    lines.append(f"- Organization Score: {profile['organization']}/100")
    return "\n".join(lines)


def _strategy_block(retrieval: RetrievalResult) -> str:
    if not retrieval.strategies:
        return ""

    blocks = [
        f"""
Pedagogical strategy to apply: {strategy['strategy_name']} ({strategy['framework']})
How to apply: {strategy['how_to_apply']}
Reference feedback style: "{strategy['feedback_example']}"
"""
        for strategy in retrieval.strategies
    ]
    return "\n" + "".join(blocks)


def _action_block(action_instruction: str | None) -> str:
    # The baseline pass sends no action at all; the agent's no-op action is treated
    # the same way, so choosing it produces a prompt identical to the baseline's.
    if not action_instruction or action_instruction == NO_ACTION:
        return ""

    return f"""
Additional instruction from the reinforcement learning agent:
{action_instruction}
"""


def _history_block(feedback_history: list[str]) -> str:
    """
    Not in the notebook, which left feedback_history unused everywhere. Without it the
    'Build on the previous feedback' action has nothing to build on and Module 4's
    consistency_with_history score has nothing to be consistent with -- so the history
    the session store keeps is surfaced to the model here.
    """
    if not feedback_history:
        return ""

    recent = feedback_history[-FEEDBACK_HISTORY_LIMIT:]
    lines = "\n".join(f"- {item}" for item in recent)
    return f"""
Feedback already given to this student on earlier turns (oldest first):
{lines}
"""


def build_prompt(
    stage: str,
    content: str,
    profile: dict,
    retrieval: RetrievalResult,
    action_instruction: str | None = None,
    feedback_history: list[str] | None = None,
) -> str:
    """Ported verbatim from get_prompt() in Feedback_Generation_Module.ipynb."""
    context = "\n\n".join(retrieval.documents)

    return f"""You are an AI writing coach helping university students improve their academic writing process.

Student Context:
- Writing Stage: {stage}
{_profile_block(profile)}
- Student's current text: "{content}"

Here are similar examples of good instructional feedback:
{context}
{_strategy_block(retrieval)}{_history_block(feedback_history or [])}{_action_block(action_instruction)}
Your task: Generate ONE short, clear piece of instructional feedback for this student.

Rules:
- Guide the student to improve their own writing - do NOT write for them
- Be specific to their content and stage
- Use action verbs (e.g., Write, Add, Replace, List, Move)
- Keep it to 1-2 sentences maximum
- Match the style of the examples above
- If a pedagogical strategy is provided above, make sure your feedback reflects that strategy's approach
- If an additional adaptation instruction is provided above, make sure your feedback follows it.

Output ONLY the feedback. Nothing else.

Feedback:"""
