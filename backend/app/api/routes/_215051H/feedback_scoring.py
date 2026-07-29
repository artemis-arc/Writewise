from fastapi import APIRouter, Depends, HTTPException

from app.api.routes._215051H.deps import get_clarity_scorer, get_feedback_retriever
from app.core.config import Settings, get_settings
from app.models._215051H.schemas import FeedbackScoringRequest, FeedbackScoringResponse
from app.services._215051H.clarity_scoring import ClarityModelNotTrainedError, ClarityScorer
from app.services._215051H.feedback_retriever import FeedbackRetriever
from app.services._215051H.feedback_scoring import evaluate_feedback

router = APIRouter(prefix="/api/v1/feedback-scoring", tags=["feedback-scoring"])


@router.post("", response_model=FeedbackScoringResponse)
async def create_feedback_score(
    payload: FeedbackScoringRequest,
    retriever: FeedbackRetriever = Depends(get_feedback_retriever),
    clarity_scorer: ClarityScorer = Depends(get_clarity_scorer),
    settings: Settings = Depends(get_settings),
) -> FeedbackScoringResponse:
    try:
        return await evaluate_feedback(payload, retriever, clarity_scorer, settings)
    except ClarityModelNotTrainedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc
