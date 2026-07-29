from pydantic import BaseModel, Field


class FeedbackScoringRequest(BaseModel):
    """
    Mirrors evaluate_feedback()'s signature in module_04_feedback_scoring_final_flow_v2.py.
    No upstream module (stage tracking, revision history) exists yet, so every input the
    scoring pipeline needs is passed explicitly rather than looked up server-side.
    """

    current_stage: str = Field(min_length=1)
    previous_stage: str = Field(min_length=1)
    current_content: str = Field(min_length=1)
    previous_content: str = ""
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
