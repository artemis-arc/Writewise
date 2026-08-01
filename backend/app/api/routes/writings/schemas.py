import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CreateDraftRequest(BaseModel):
    content_text: str = ""
    task_definition_id: uuid.UUID | None = None


class UpdateDraftRequest(BaseModel):
    content_text: str = Field(default="")


class DraftResponse(BaseModel):
    id: uuid.UUID
    content_text: str
    updated_at: datetime
