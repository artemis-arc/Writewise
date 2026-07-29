from typing import Literal

from pydantic import BaseModel, Field, model_validator

WriterLevel = Literal["low", "medium", "high"]
WritingStage = Literal["PLANNING", "IMPLEMENTATION", "REVISION"]


class WritingProfileScores(BaseModel):
    """Module 2's 0-100 rubric scores for this writer."""

    mechanics: float = Field(ge=0, le=100)
    vocabulary: float = Field(ge=0, le=100)
    organization: float = Field(ge=0, le=100)


class MilestoneProgress(BaseModel):
    """How far through Module 1's task breakdown the writer is. Decides the stage."""

    completed: int = Field(ge=0)
    total: int = Field(ge=0)

    @model_validator(mode="after")
    def _completed_within_total(self) -> "MilestoneProgress":
        if self.completed > self.total:
            raise ValueError("completed cannot exceed total milestones.")
        return self


class FeedbackRequest(BaseModel):
    # Opaque, client-generated, one per document being written. Keys the feedback
    # history that later turns are asked to stay consistent with.
    session_id: str = Field(min_length=1, max_length=128)

    # Legitimately empty at the very start of PLANNING -- several knowledge base
    # examples are keyed on a writer who has not typed anything yet.
    content: str = ""

    writing_profile: WritingProfileScores
    milestone_progress: MilestoneProgress

    # Escape hatches for evaluation and for a future stage picker in the UI: supply
    # either and it wins over the value derived from progress and scores.
    stage: WritingStage | None = None
    writer_level: WriterLevel | None = None


class FeedbackScores(BaseModel):
    """Module 4's six WRFEF measures, each 0-1. These are what the RL state is built from."""

    relevance: float = Field(ge=0, le=1)
    clarity: float = Field(ge=0, le=1)
    actionability: float = Field(ge=0, le=1)
    stage_alignment: float = Field(ge=0, le=1)
    improvement_impact: float = Field(ge=0, le=1)
    consistency_with_history: float = Field(ge=0, le=1)


class FeedbackDiagnostics(BaseModel):
    """
    What the agent did and why. Not needed to render feedback to a writer -- it is here
    so the RL loop can be observed from outside during the study, without reading the
    Q-table file by hand.
    """

    action: str
    action_index: int
    used_rl_action: bool
    baseline_state: int
    final_state: int
    reward: int
    scores: FeedbackScores
    strategies: list[str]


class FeedbackResponse(BaseModel):
    feedback: str
    stage: WritingStage
    writer_level: WriterLevel
    diagnostics: FeedbackDiagnostics
