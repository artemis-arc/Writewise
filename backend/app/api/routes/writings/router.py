import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.writings.schemas import CreateDraftRequest, DraftResponse, UpdateDraftRequest
from app.auth.deps import get_current_user
from app.db.models import User, WritingSubmission
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/writings", tags=["writings"])


@router.post("", response_model=DraftResponse, status_code=201)
def create_draft(
    payload: CreateDraftRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DraftResponse:
    draft = WritingSubmission(
        user_id=current_user.id,
        source="editor_draft",
        content_text=payload.content_text,
        task_definition_id=payload.task_definition_id,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    return DraftResponse(id=draft.id, content_text=draft.content_text, updated_at=draft.updated_at)


@router.put("/{draft_id}", response_model=DraftResponse)
def update_draft(
    draft_id: uuid.UUID,
    payload: UpdateDraftRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DraftResponse:
    draft = (
        db.query(WritingSubmission)
        .filter(
            WritingSubmission.id == draft_id,
            WritingSubmission.user_id == current_user.id,
            WritingSubmission.source == "editor_draft",
        )
        .first()
    )
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found.")

    draft.content_text = payload.content_text
    db.commit()
    db.refresh(draft)

    return DraftResponse(id=draft.id, content_text=draft.content_text, updated_at=draft.updated_at)
