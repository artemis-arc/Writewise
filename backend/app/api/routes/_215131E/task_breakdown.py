import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes._215131E.deps import get_retriever
from app.auth.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.models import TaskDefinition, User, WritingSubmission
from app.db.session import get_db
from app.models._215131E.schemas import TaskBreakdownRequest, TaskBreakdownResponse
from app.services._215131E.scenario_retriever import ScenarioRetriever
from app.services._215131E.task_define import generate_task_breakdown

router = APIRouter(prefix="/api/v1/task-breakdown", tags=["task-breakdown"])


@router.post("", response_model=TaskBreakdownResponse)
async def create_task_breakdown(
    payload: TaskBreakdownRequest,
    retriever: ScenarioRetriever = Depends(get_retriever),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskBreakdownResponse:
    try:
        result = await generate_task_breakdown(payload, retriever, settings)
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc

    task_definition = TaskDefinition(
        user_id=current_user.id,
        task=payload.task,
        academic_level=payload.academic_level,
        citation_style=payload.citation_style,
        milestones_json=[m.model_dump() for m in result.milestones],
        actions_json=result.actions.model_dump(),
    )
    db.add(task_definition)
    db.flush()

    if payload.submission_id:
        try:
            submission_uuid = uuid.UUID(payload.submission_id)
        except ValueError:
            submission_uuid = None
        if submission_uuid is not None:
            submission = (
                db.query(WritingSubmission)
                .filter(
                    WritingSubmission.id == submission_uuid,
                    WritingSubmission.user_id == current_user.id,
                )
                .first()
            )
            if submission is not None:
                submission.task_definition_id = task_definition.id

    db.commit()

    result.task_definition_id = str(task_definition.id)
    return result
