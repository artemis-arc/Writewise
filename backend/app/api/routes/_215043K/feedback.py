from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes._215043K.deps import get_feedback_engine
from app.auth.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.models import User
from app.db.session import get_db
from app.models._215043K.schemas import (
    FeedbackDiagnostics,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackScores,
    WritingProfileScores,
)
from app.services._215043K.engine import FeedbackEngine
from app.services._215043K.evaluator import Module4UnavailableError
from app.services._215043K.pipeline import generate_feedback
from app.services._215043K.profile import (
    InvalidSubmissionIdError,
    load_profile_scores,
    resolve_writer_level,
)

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


def _resolve_profile(
    payload: FeedbackRequest, current_user: User, db: Session
) -> WritingProfileScores:
    """
    Module 1's (215131E) scores for this writer, from the request only if the caller
    deliberately overrode them.
    """
    if payload.writing_profile is not None:
        return payload.writing_profile

    try:
        profile = load_profile_scores(
            db, user_id=current_user.id, submission_id=payload.submission_id
        )
    except InvalidSubmissionIdError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if profile is not None:
        return profile

    if payload.submission_id is not None:
        # Deliberately does not distinguish "no such submission" from "not yours" --
        # telling them apart would confirm which ids exist to someone guessing.
        raise HTTPException(
            status_code=404,
            detail="No writing profile found for that submission.",
        )

    raise HTTPException(
        status_code=409,
        detail=(
            "No writing profile yet. Upload a document to /api/v1/writing-profile "
            "before requesting feedback."
        ),
    )


# Deliberately `def`, not `async def`: one call runs up to four blocking network round
# trips (two Gemini generations, two Module 4 evaluations). FastAPI runs sync routes in
# a threadpool, so those seconds do not block the event loop and every other request
# with it -- which an `async def` doing the same blocking work would
@router.post("", response_model=FeedbackResponse)
def create_feedback(
    payload: FeedbackRequest,
    engine: FeedbackEngine = Depends(get_feedback_engine),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackResponse:
    profile = _resolve_profile(payload, current_user, db)
    print("Resolved profile:")
    print(profile.model_dump())

    # Module 2 (215098G) classifies the stage and tracks the previous draft; both arrive
    # on the request already decided
    stage = payload.stage
    writer_level = payload.writer_level or resolve_writer_level(
        overall=profile.overall,
        low_cutoff=settings.feedback_writer_level_low_cutoff,
        medium_cutoff=settings.feedback_writer_level_medium_cutoff,
    )

    try:
        result = generate_feedback(
            session_id=payload.session_id,
            stage=stage,
            writer_level=writer_level,
            content=payload.content,
            mechanics=profile.mechanics,
            vocabulary=profile.vocabulary,
            organization=profile.organization,
            engine=engine,
            settings=settings,
        )
    except Module4UnavailableError as exc:
        # The RL agent cannot pick an action without Module 4's six scores, and a
        # Q-update without them would poison the table -- so fail rather than degrade.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return FeedbackResponse(
        feedback=result.feedback,
        stage=result.stage,
        writer_level=result.writer_level,
        diagnostics=FeedbackDiagnostics(
            action=result.action,
            action_index=result.action_index,
            used_rl_action=result.used_rl_action,
            baseline_state=result.baseline_state,
            final_state=result.final_state,
            reward=result.reward,
            scores=FeedbackScores(**result.scores),
            strategies=result.strategies,
        ),
    )
