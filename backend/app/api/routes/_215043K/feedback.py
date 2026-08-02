import logging
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request
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
    WriterLevel,
    WritingProfileScores,
    WritingStage,
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
logger = logging.getLogger("uvicorn.error")


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
# with it -- which an `async def` doing the same blocking work would.
#
# TODO: an SSE variant of this route would let the editor render the feedback as it is
# written rather than after the whole pipeline finishes -- the frontend panel currently
# shows a placeholder for those seconds. It would forward Gemini's own token stream as
# text deltas, then emit the scores and diagnostics as a final event, since the RL
# action and Module 4 measures are only decided once the feedback is complete.
@router.post(
    "",
    responses={
        400: {"description": "Invalid submission identifier."},
        404: {"description": "No writing profile found for that submission."},
        409: {"description": "No writing profile yet for this session."},
        422: {
            "description": "No Module 2 boundary trigger is available for this session yet."
        },
        503: {"description": "Module 4 is unavailable."},
    },
)
def create_feedback(
    payload: FeedbackRequest,
    request: Request,
    engine: Annotated[FeedbackEngine, Depends(get_feedback_engine)],
    settings: Annotated[Settings, Depends(get_settings)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FeedbackResponse:
    boundary_detector = getattr(request.app.state, "boundary_detector", None)
    boundary_trigger = (
        boundary_detector.latest_trigger(payload.session_id)
        if boundary_detector is not None
        else None
    )
    if boundary_trigger is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "No Module 2 boundary trigger is available for this session yet. "
                "Call /api/v1/stage-classification until a stage transition fires."
            ),
        )

    logger.info(
        "Module 3 triggered by Module 2 boundary: session_id=%s timestamp=%s stage_before_transition=%s new_stage=%s pause_seconds=%.3f",
        boundary_trigger.session_id,
        boundary_trigger.timestamp,
        boundary_trigger.stage_before_transition,
        boundary_trigger.stage_after_transition,
        boundary_trigger.pause_seconds,
    )

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
        logger.exception(
            "Module 3 feedback generation failed: session_id=%s",
            payload.session_id,
        )
        # The RL agent cannot pick an action without Module 4's six scores, and a
        # Q-update without them would poison the table -- so fail rather than degrade.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return FeedbackResponse(
        feedback=result.feedback,
        stage=cast(WritingStage, result.stage),
        writer_level=cast(WriterLevel, result.writer_level),
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
