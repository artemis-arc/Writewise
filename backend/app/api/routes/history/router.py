import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.routes.history.schemas import (
    EXCERPT_LENGTH,
    ScoreEntry,
    SubmissionDetail,
    SubmissionSummary,
)
from app.auth.deps import get_current_user
from app.db.models import SubmissionScore, TaskDefinition, User, WritingSubmission
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/history", tags=["history"])


def _excerpt(text: str) -> str:
    stripped = text.strip()
    if len(stripped) <= EXCERPT_LENGTH:
        return stripped
    return f"{stripped[:EXCERPT_LENGTH].rstrip()}..."


@router.get("/scores", response_model=list[ScoreEntry])
def list_scores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScoreEntry]:
    rows = (
        db.query(SubmissionScore, WritingSubmission, TaskDefinition)
        .join(WritingSubmission, WritingSubmission.id == SubmissionScore.submission_id)
        .outerjoin(TaskDefinition, TaskDefinition.id == WritingSubmission.task_definition_id)
        .filter(WritingSubmission.user_id == current_user.id)
        .order_by(desc(SubmissionScore.scored_at))
        .all()
    )

    return [
        ScoreEntry(
            id=score.id,
            submission_id=submission.id,
            mechanics=float(score.mechanics),
            organization=float(score.organization),
            overall=float(score.overall),
            scored_at=score.scored_at,
            source=submission.source,
            original_filename=submission.original_filename,
            task=task.task if task else None,
        )
        for score, submission, task in rows
    ]


@router.get("/submissions", response_model=list[SubmissionSummary])
def list_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SubmissionSummary]:
    submissions = (
        db.query(WritingSubmission)
        .filter(WritingSubmission.user_id == current_user.id)
        .order_by(desc(WritingSubmission.created_at))
        .all()
    )

    summaries = []
    for submission in submissions:
        latest_score = max(submission.scores, key=lambda s: s.scored_at, default=None)
        summaries.append(
            SubmissionSummary(
                id=submission.id,
                source=submission.source,
                original_filename=submission.original_filename,
                excerpt=_excerpt(submission.content_text),
                created_at=submission.created_at,
                updated_at=submission.updated_at,
                latest_overall_score=float(latest_score.overall) if latest_score else None,
            )
        )
    return summaries


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionDetail:
    submission = (
        db.query(WritingSubmission)
        .filter(
            WritingSubmission.id == submission_id,
            WritingSubmission.user_id == current_user.id,
        )
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found.")

    task = (
        db.query(TaskDefinition).filter(TaskDefinition.id == submission.task_definition_id).first()
        if submission.task_definition_id
        else None
    )

    return SubmissionDetail(
        id=submission.id,
        source=submission.source,
        original_filename=submission.original_filename,
        content_text=submission.content_text,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        task=task.task if task else None,
        scores=[
            ScoreEntry(
                id=score.id,
                submission_id=submission.id,
                mechanics=float(score.mechanics),
                organization=float(score.organization),
                overall=float(score.overall),
                scored_at=score.scored_at,
                source=submission.source,
                original_filename=submission.original_filename,
                task=task.task if task else None,
            )
            for score in submission.scores
        ],
    )
