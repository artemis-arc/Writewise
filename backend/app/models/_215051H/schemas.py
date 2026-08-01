from pydantic import BaseModel, Field


class FeedbackScoringRequest(BaseModel):
    """
    Mirrors evaluate_feedback()'s signature in module_04_feedback_scoring_final_flow_v2.py.

    current_stage/previous_stage/current_content/previous_content are optional: when omitted,
    the feedback-scoring endpoint fills them in from Module 2's stage-classification state
    (the most recent /api/v1/stage-classification call's output stage and before/after text).
    Pass them explicitly to override or when no stage-classification call has happened yet.
    """

    session_id: str = Field(min_length=1, max_length=128)
    current_stage: str | None = Field(default=None, min_length=1)
    previous_stage: str | None = Field(default=None, min_length=1)
    current_content: str | None = Field(default=None, min_length=1)
    previous_content: str | None = None
    given_feedback: str = Field(min_length=1)
    feedback_history: list[str] = Field(default_factory=list)


class DimensionScore(BaseModel):
    score: float = Field(ge=0, le=1)
    reasoning: str


class FeedbackDimensionScores(BaseModel):
    relevance: DimensionScore
    clarity: DimensionScore
    actionability: DimensionScore
    stage_alignment: DimensionScore
    improvement_impact: DimensionScore
    consistency_with_history: DimensionScore


class FeedbackScoringResponse(BaseModel):
    overall_score: float = Field(ge=0, le=1)
    dimensions: FeedbackDimensionScores
