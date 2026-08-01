from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.routes._215051H.deps import get_clarity_scorer, get_feedback_retriever
from app.core.config import Settings, get_settings
from app.models._215051H.schemas import FeedbackScoringRequest, FeedbackScoringResponse
from app.services._215051H.clarity_scoring import ClarityModelNotTrainedError, ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215051H.feedback_scoring import evaluate_feedback

router = APIRouter(prefix="/api/v1/feedback-scoring", tags=["feedback-scoring"])


def _fill_from_stage_context(
    payload: FeedbackScoringRequest, request: Request
) -> FeedbackScoringRequest:
    """Fill missing stage/content fields from Module 2's stage-classification state.

    current_stage/current_content come from the latest recorded classify call;
    previous_stage comes from the entry recorded just before it (falling back to
    current_stage when there is no earlier transition yet).
    """
    if payload.current_stage and payload.current_content:
        return payload

    stage_context = getattr(request.app.state, "stage_context", None)
    if stage_context is None:
        return payload

    snapshot = stage_context.snapshot(payload.session_id)
    latest = snapshot["latest"]
    if latest is None:
        return payload

    history = snapshot["history"]
    previous = history[-2] if len(history) >= 2 else latest

    return payload.model_copy(
        update={
            "current_stage": payload.current_stage or latest["stage"],
            "previous_stage": payload.previous_stage or previous["stage"],
            "current_content": payload.current_content or latest["after_text"],
            "previous_content": (
                payload.previous_content
                if payload.previous_content is not None
                else latest["before_text"]
            ),
        }
    )


@router.post(
    "",
    responses={
        422: {"description": "Stage context is unavailable for this session."},
        502: {"description": "Model returned an unexpected shape."},
        503: {"description": "Clarity model is not trained."},
    },
)
async def create_feedback_score(
    payload: FeedbackScoringRequest,
    request: Request,
    retriever: Annotated[FeedbackRetriever, Depends(get_feedback_retriever)],
    clarity_scorer: Annotated[ClarityScorer, Depends(get_clarity_scorer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> FeedbackScoringResponse:
    payload = _fill_from_stage_context(payload, request)
    if not payload.current_stage or not payload.current_content:
        raise HTTPException(
            status_code=422,
            detail=(
                "current_stage/current_content were not provided and no "
                "stage-classification data is available yet. Call "
                "/api/v1/stage-classification first for this session or supply these fields explicitly."
            ),
        )

    try:
        return await evaluate_feedback(payload, retriever, clarity_scorer, settings)
    except ClarityModelNotTrainedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc
