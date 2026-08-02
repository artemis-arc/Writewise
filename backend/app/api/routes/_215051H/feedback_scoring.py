from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.routes._215051H.deps import get_clarity_scorer, get_feedback_retriever
from app.core.config import Settings, get_settings
from app.models._215051H.schemas import FeedbackScoringRequest, FeedbackScoringResponse
from app.services._215051H.clarity_scoring import (
    ClarityModelNotTrainedError,
    ClarityScorer,
)
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215051H.feedback_scoring import (
    MissingWritingContextError,
    evaluate_feedback,
)

router = APIRouter(prefix="/api/v1/feedback-scoring", tags=["feedback-scoring"])


@router.post(
    "",
    responses={
        422: {"description": "No writing context supplied and none recorded upstream."},
        502: {"description": "The scoring model answered with something unusable."},
        503: {"description": "The clarity model is not trained yet."},
    },
)
async def create_feedback_score(
    payload: FeedbackScoringRequest,
    request: Request,
    retriever: Annotated[FeedbackRetriever, Depends(get_feedback_retriever)],
    clarity_scorer: Annotated[ClarityScorer, Depends(get_clarity_scorer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> FeedbackScoringResponse:
    try:
        # Resolving the writing context is the service's job now, so the in-process
        # caller (Module 3) gets exactly the same fill this endpoint does.
        return evaluate_feedback(
            payload,
            retriever,
            clarity_scorer,
            settings,
            session_id=payload.session_id,
            stage_context=getattr(request.app.state, "stage_context", None),
        )
    except ClarityModelNotTrainedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    # Ahead of the ValueError clause below, which it subclasses.
    except MissingWritingContextError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc
