from fastapi import APIRouter, HTTPException, Request

from app.api.routes._215098G.deps import get_stage_classifier_bundle
from app.models._215098G.schemas import (
    StageClassificationBatchRequest,
    StageClassificationBatchResponse,
    StageClassificationRequest,
    StageClassificationResponse,
)
from app.services._215098G.ml_pipeline.inference import predict, predict_proba

router = APIRouter(prefix="/api/v1/stage-classification", tags=["stage-classification"])


def _classify_event(
    bundle, payload: StageClassificationRequest
) -> StageClassificationResponse:
    stage = predict(bundle, [payload.before_text], [payload.after_text])[0]
    confidence = float(
        max(predict_proba(bundle, [payload.before_text], [payload.after_text])[0])
    )
    return StageClassificationResponse(stage=stage, confidence=confidence)


@router.post(
    "",
    responses={
        502: {"description": "Model returned an unexpected shape."},
        503: {"description": "Module 2 artifacts are missing."},
    },
)
async def classify_stage(
    payload: StageClassificationRequest,
    request: Request,
) -> StageClassificationResponse:
    bundle = get_stage_classifier_bundle(request)

    if bundle is None:
        error = getattr(request.app.state, "stage_classifier_error", None)
        raise HTTPException(
            status_code=503,
            detail=str(error)
            if error is not None
            else "Module 2 artifacts are missing.",
        )

    try:
        return _classify_event(bundle, payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (KeyError, ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc


@router.post(
    "/batch",
    responses={
        502: {"description": "Model returned an unexpected shape."},
        503: {"description": "Module 2 artifacts are missing."},
    },
)
async def classify_stage_batch(
    payload: StageClassificationBatchRequest,
    request: Request,
) -> StageClassificationBatchResponse:
    bundle = get_stage_classifier_bundle(request)

    if bundle is None:
        error = getattr(request.app.state, "stage_classifier_error", None)
        raise HTTPException(
            status_code=503,
            detail=str(error)
            if error is not None
            else "Module 2 artifacts are missing.",
        )

    try:
        events = [_classify_event(bundle, event) for event in payload.events]
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (KeyError, ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model response did not match the expected shape: {exc}",
        ) from exc

    return StageClassificationBatchResponse(
        events=events, latest=events[-1] if events else None
    )
