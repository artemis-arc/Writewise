from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.routes._215131E.deps import get_srsd_scorer
from app.core.config import Settings, get_settings
from app.models._215131E.schemas import WritingProfileResponse
from app.services._215131E.document_parser import UnsupportedFileTypeError, extract_text
from app.services._215131E.srsd_scoring import (
    DUMMY_MECHANICS_SCORE,
    DUMMY_VOCABULARY_SCORE,
    SrsdScorer,
)

router = APIRouter(prefix="/api/v1/writing-profile", tags=["writing-profile"])


@router.post("", response_model=WritingProfileResponse)
async def create_writing_profile(
    file: UploadFile = File(...),
    scorer: SrsdScorer = Depends(get_srsd_scorer),
    settings: Settings = Depends(get_settings),
) -> WritingProfileResponse:
    if file.size is not None and file.size > settings.srsd_max_upload_bytes:
        raise HTTPException(status_code=413, detail="File exceeds the 25MB upload limit.")

    try:
        text = await extract_text(file)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract any text from the uploaded file.",
        )

    organization = scorer.score_organization(text)
    vocabulary = DUMMY_VOCABULARY_SCORE
    mechanics = DUMMY_MECHANICS_SCORE
    overall = round((vocabulary + mechanics + organization) / 3)

    return WritingProfileResponse(
        vocabulary=vocabulary,
        mechanics=mechanics,
        organization=organization,
        overall=overall,
    )
