from pydantic import BaseModel, Field


class WritingProfileScores(BaseModel):
    """0-100 scores, matching the shape SRSD_content_scoring.ipynb is expected to eventually produce."""

    mechanics: float = Field(ge=0, le=100)
    vocabulary: float = Field(ge=0, le=100)
    organization: float = Field(ge=0, le=100)


class TaskBreakdownRequest(BaseModel):
    task: str = Field(min_length=1)
    academic_level: str
    citation_style: str = "APA7"
    writing_profile: WritingProfileScores


class Milestone(BaseModel):
    order: int
    title: str
    description: str


class ActionSet(BaseModel):
    mechanics: list[str]
    vocabulary: list[str]
    organization: list[str]


class TaskBreakdownResponse(BaseModel):
    milestones: list[Milestone]
    actions: ActionSet


class WritingProfileResponse(BaseModel):
    vocabulary: float = Field(ge=0, le=100)
    mechanics: float = Field(ge=0, le=100)
    organization: float = Field(ge=0, le=100)
    overall: float = Field(ge=0, le=100)
