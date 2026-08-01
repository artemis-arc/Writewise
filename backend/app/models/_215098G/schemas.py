from pydantic import BaseModel, Field


class StageClassificationRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    before_text: str
    after_text: str
    timestamp: float


class StageClassificationResponse(BaseModel):
    stage: str
    confidence: float = Field(ge=0, le=1)
    before_text: str
    after_text: str
    timestamp: float


class StageClassificationBatchRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    events: list[StageClassificationRequest] = Field(min_length=1)


class StageClassificationBatchResponse(BaseModel):
    events: list[StageClassificationResponse]
    latest: StageClassificationResponse | None = None


class StageSignalSnapshot(BaseModel):
    stage: str
    confidence: float = Field(ge=0, le=1)
    timestamp: float
    before_text: str
    after_text: str


class StageClassificationStateResponse(BaseModel):
    latest: StageSignalSnapshot | None = None
    history: list[StageSignalSnapshot] = Field(default_factory=list)
