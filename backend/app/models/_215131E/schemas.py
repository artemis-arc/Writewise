from pydantic import BaseModel, Field


class WritingProfileScores(BaseModel):
    """0-100 scores. Vocabulary is deferred to future work and intentionally not scored here."""

    mechanics: float = Field(ge=0, le=100)
    organization: float = Field(ge=0, le=100)


class TaskBreakdownRequest(BaseModel):
    task: str = Field(min_length=1)
    academic_level: str
    citation_style: str = "APA7"
    writing_profile: WritingProfileScores
    submission_id: str | None = None


class Milestone(BaseModel):
    order: int
    title: str
    description: str


class ActionSet(BaseModel):
    mechanics: list[str]
    organization: list[str]


class TaskBreakdownResponse(BaseModel):
    milestones: list[Milestone]
    actions: ActionSet
    task_definition_id: str | None = None


class WritingProfileResponse(BaseModel):
    mechanics: float = Field(ge=0, le=100)
    organization: float = Field(ge=0, le=100)
    overall: float = Field(ge=0, le=100)
    submission_id: str | None = None
