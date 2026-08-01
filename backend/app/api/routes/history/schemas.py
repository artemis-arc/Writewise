import uuid
from datetime import datetime

from pydantic import BaseModel

EXCERPT_LENGTH = 240


class ScoreEntry(BaseModel):
    id: uuid.UUID
    submission_id: uuid.UUID
    mechanics: float
    organization: float
    overall: float
    scored_at: datetime
    source: str
    original_filename: str | None
    task: str | None


class SubmissionSummary(BaseModel):
    id: uuid.UUID
    source: str
    original_filename: str | None
    excerpt: str
    created_at: datetime
    updated_at: datetime
    latest_overall_score: float | None


class SubmissionDetail(BaseModel):
    id: uuid.UUID
    source: str
    original_filename: str | None
    content_text: str
    created_at: datetime
    updated_at: datetime
    scores: list[ScoreEntry]
    task: str | None
