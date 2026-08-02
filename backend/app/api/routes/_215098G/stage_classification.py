import logging

from fastapi import APIRouter, HTTPException, Request

from app.api.routes._215098G.deps import get_stage_classifier_bundle
from app.models._215098G.schemas import (
    StageClassificationBatchRequest,
    StageClassificationBatchResponse,
    StageClassificationInput,
    StageClassificationRequest,
    StageClassificationResponse,
    StageClassificationStateResponse,
)
from app.services._215098G.ml_pipeline.inference import predict, predict_proba

router = APIRouter(prefix="/api/v1/stage-classification", tags=["stage-classification"])
logger = logging.getLogger("uvicorn.error")


def _classify_event(
    bundle, payload: StageClassificationInput
) -> StageClassificationResponse:
    timestamps = [payload.timestamp]
    stage = predict(
        bundle, [payload.before_text], [payload.after_text], timestamps=timestamps
    )[0]
    confidence = float(
        max(
            predict_proba(
                bundle,
                [payload.before_text],
                [payload.after_text],
                timestamps=timestamps,
            )[0]
        )
    )
    logger.info(
        "Module 2 classified writing stage: stage=%s confidence=%.3f timestamp=%s",
        stage,
        confidence,
        payload.timestamp,
    )
    return StageClassificationResponse(
        stage=stage,
        confidence=confidence,
        before_text=payload.before_text,
        after_text=payload.after_text,
        timestamp=payload.timestamp,
    )


def _record_stage_context(
    request: Request,
    response: StageClassificationResponse,
    session_id: str,
    payload: StageClassificationInput,
) -> None:
    stage_context = getattr(request.app.state, "stage_context", None)
    if stage_context is None:
        return

    stage_context.record(
        session_id=session_id,
        stage=response.stage,
        confidence=response.confidence,
        timestamp=payload.timestamp,
        before_text=payload.before_text,
        after_text=payload.after_text,
    )


def _detect_boundary(request: Request, session_id: str) -> None:
    boundary_detector = getattr(request.app.state, "boundary_detector", None)
    if boundary_detector is None:
        return

    boundary_detector.detect(session_id)


@router.get("/state")
async def get_stage_classification_state(
    session_id: str,
    request: Request,
) -> StageClassificationStateResponse:
    stage_context = getattr(request.app.state, "stage_context", None)
    if stage_context is None:
        return StageClassificationStateResponse()

    return StageClassificationStateResponse.model_validate(
        stage_context.snapshot(session_id)
    )


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
        response = _classify_event(bundle, payload)
        _record_stage_context(request, response, payload.session_id, payload)
        _detect_boundary(request, payload.session_id)
        return response
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

    for event, response in zip(payload.events, events, strict=True):
        _record_stage_context(request, response, payload.session_id, event)
        _detect_boundary(request, payload.session_id)

    if events:
        logger.info(
            "Module 2 batch classification completed: events=%s latest_stage=%s latest_confidence=%.3f",
            len(events),
            events[-1].stage,
            events[-1].confidence,
        )

    return StageClassificationBatchResponse(
        events=events, latest=events[-1] if events else None
    )
