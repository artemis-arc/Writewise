from fastapi import APIRouter, Depends, HTTPException

from app.api.routes._215043K.deps import get_feedback_engine
from app.core.config import Settings, get_settings
from app.models._215043K.schemas import (
    FeedbackDiagnostics,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackScores,
)
from app.services._215043K.engine import FeedbackEngine
from app.services._215043K.evaluator import Module4UnavailableError
from app.services._215043K.pipeline import generate_feedback
from app.services._215043K.profile import resolve_stage, resolve_writer_level

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


# Deliberately `def`, not `async def`: one call runs up to four blocking network round
# trips (two Gemini generations, two Module 4 evaluations). FastAPI runs sync routes in
# a threadpool, so those seconds do not block the event loop and every other request
# with it -- which an `async def` doing the same blocking work would.
@router.post("", response_model=FeedbackResponse)
def create_feedback(
    payload: FeedbackRequest,
    engine: FeedbackEngine = Depends(get_feedback_engine),
    settings: Settings = Depends(get_settings),
) -> FeedbackResponse:
    profile = payload.writing_profile

    stage = payload.stage or resolve_stage(
        completed_milestones=payload.milestone_progress.completed,
        total_milestones=payload.milestone_progress.total,
        planning_cutoff=settings.feedback_planning_cutoff,
        implementation_cutoff=settings.feedback_implementation_cutoff,
    )
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
