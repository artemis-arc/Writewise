from pydantic import BaseModel, Field


class StageClassificationRequest(BaseModel):
    before_text: str
    after_text: str
    timestamp: float


class StageClassificationResponse(BaseModel):
    stage: str
    confidence: float = Field(ge=0, le=1)


class StageClassificationBatchRequest(BaseModel):
    events: list[StageClassificationRequest] = Field(min_length=1)


class StageClassificationBatchResponse(BaseModel):
    events: list[StageClassificationResponse]
    latest: StageClassificationResponse | None = None
