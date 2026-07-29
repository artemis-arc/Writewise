import json

from app.core.config import Settings
from app.models._215051H.schemas import (
    DimensionScore,
    FeedbackDimensionScores,
    FeedbackScoringRequest,
    FeedbackScoringResponse,
)
from app.services._215051H.clarity_scoring import ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215051H.gemini_client import generate_json
from app.services._215051H.wrfef import DIMENSIONS, SCORING_RUBRIC, WRFEF, WRFEF_WEIGHTS


def _format_feedback_history(feedback_history: list[str]) -> str:
    if not feedback_history:
        return "None"
    return "\n".join(f"- {item}" for item in feedback_history)


def _build_prompt(payload: FeedbackScoringRequest, retrieved_context: str) -> str:
    dimension_lines = "\n".join(
        f"{i + 1}. {name} — " + info["theory"] + ": " + info["purpose"]
        for i, (name, info) in enumerate(WRFEF.items())
    )

    rubric_lines = "\n\n".join(
        f"{dimension} (0.0-1.0 scale):\n" + "\n".join(f"  {band}: {desc}" for band, desc in bands.items())
        for dimension, bands in SCORING_RUBRIC.items()
    )

    return f"""
You are an expert academic writing feedback evaluator for IT undergraduate research article writing.

Your task is to evaluate the quality of the given feedback based on the student's current writing context, previous writing context, stage transitions, and feedback history.
Evaluate the feedback using the WriteWise Research-Based Feedback Evaluation Framework (WRFEF).

The evaluation must follow these six dimensions:

{dimension_lines}

For each dimension, follow the predefined scoring rubric below, then assign the most appropriate score AND write ONE brief sentence of reasoning grounded in the writing context and the retrieved evidence.

========================
CURRENT WRITING CONTEXT
========================

Current Stage:
{payload.current_stage}

Previous Stage:
{payload.previous_stage}

Current Content:
{payload.current_content}

Previous Content:
{payload.previous_content}

========================
FEEDBACK TO EVALUATE
========================

Feedback:
{payload.given_feedback}

========================
PREVIOUS FEEDBACK HISTORY
========================

{_format_feedback_history(payload.feedback_history)}

========================
RETRIEVED KNOWLEDGE BASE CONTEXT
========================

{retrieved_context}

========================
SCORING RUBRIC (WRFEF)
========================

{rubric_lines}

========================
IMPORTANT INSTRUCTIONS
========================

- ALL SCORES MUST BE BETWEEN 0.0 AND 1.0. NEVER output a value greater than 1.0.
- Each "reasoning" must be ONE concise sentence (max ~25 words), specific to this feedback and context.
- Use the retrieved KB context as grounding.
- Consider stage transitions carefully.
- Reward specific, stage-appropriate, actionable and educationally meaningful feedback. Penalize vague, generic, repetitive or contradictory feedback.
- Use the student's writing context and feedback history throughout the evaluation.

========================
OUTPUT FORMAT
========================

Return ONLY valid JSON in exactly this schema:

{{
  "relevance": {{"score": 0.0, "reasoning": "..."}},
  "clarity": {{"score": 0.0, "reasoning": "..."}},
  "actionability": {{"score": 0.0, "reasoning": "..."}},
  "stage_alignment": {{"score": 0.0, "reasoning": "..."}},
  "improvement_impact": {{"score": 0.0, "reasoning": "..."}},
  "consistency_with_history": {{"score": 0.0, "reasoning": "..."}}
}}

Do not include markdown or extra text outside the JSON.
"""


def _build_query(payload: FeedbackScoringRequest) -> str:
    return f"""
Current Stage:
{payload.current_stage}

Previous Stage:
{payload.previous_stage}

Current Content:
{payload.current_content}

Previous Content:
{payload.previous_content}

Current Feedback:
{payload.given_feedback}

Previous Feedback:
{_format_feedback_history(payload.feedback_history)}
"""


async def evaluate_feedback(
    payload: FeedbackScoringRequest,
    retriever: FeedbackRetriever,
    clarity_scorer: ClarityScorer,
    settings: Settings,
) -> FeedbackScoringResponse:
    retrieved_docs = retriever.retrieve(_build_query(payload), k=6)
    prompt = _build_prompt(payload, "\n".join(retrieved_docs))

    # Gemini's JSON mode is not a hard schema guarantee -- retry once before giving
    # up, same pattern task_define.py uses (the Gemini call itself already retries
    # on rate limits/transient errors inside generate_json).
    attempts = 2
    data = None
    last_error: json.JSONDecodeError | None = None
    for _ in range(attempts):
        raw_response = generate_json(prompt, settings)
        try:
            data = json.loads(raw_response)
            break
        except json.JSONDecodeError as exc:
            last_error = exc
    if data is None:
        raise ValueError(f"Gemini did not return valid JSON after {attempts} attempts: {last_error}")

    scores: dict[str, DimensionScore] = {}
    for dim in DIMENSIONS:
        entry = data[dim]
        scores[dim] = DimensionScore(
            score=min(1.0, max(0.0, float(entry["score"]))),
            reasoning=str(entry.get("reasoning", "")).strip(),
        )

    # Replace the LLM's clarity guess with the trained ML clarity model's prediction.
    ml_score, ml_reasoning, _ = clarity_scorer.predict_clarity(payload.given_feedback)
    llm_clarity_reasoning = scores["clarity"].reasoning
    scores["clarity"] = DimensionScore(
        score=round(ml_score, 3),
        reasoning=ml_reasoning + (f" LLM contextual note: {llm_clarity_reasoning}" if llm_clarity_reasoning else ""),
    )

    overall = sum(scores[dim].score * WRFEF_WEIGHTS[dim] for dim in DIMENSIONS)

    return FeedbackScoringResponse(
        overall_score=round(overall, 3),
        dimensions=FeedbackDimensionScores(**scores),
    )
