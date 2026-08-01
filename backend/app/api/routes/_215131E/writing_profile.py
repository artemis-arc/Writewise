from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.routes._215131E.deps import get_srsd_scorer
from app.auth.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.models import SubmissionScore, User, WritingSubmission
from app.db.session import get_db
from app.models._215131E.schemas import WritingProfileResponse
from app.services._215131E.document_parser import UnsupportedFileTypeError, extract_text
from app.services._215131E.mechanics_scoring import score_mechanics
from app.services._215131E.srsd_scoring import SrsdScorer

router = APIRouter(prefix="/api/v1/writing-profile", tags=["writing-profile"])


@router.post("", response_model=WritingProfileResponse)
async def create_writing_profile(
    file: UploadFile = File(...),
    scorer: SrsdScorer = Depends(get_srsd_scorer),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    try:
        mechanics = score_mechanics(text, settings)
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Mechanics scoring model did not return a usable response: {exc}",
        ) from exc
    overall = round((mechanics + organization) / 2)

    submission = WritingSubmission(
        user_id=current_user.id,
        source="writing_profile_upload",
        original_filename=file.filename,
        content_text=text,
    )
    db.add(submission)
    db.flush()
    db.add(
        SubmissionScore(
            submission_id=submission.id,
            mechanics=mechanics,
            organization=organization,
            overall=overall,
            scorer_version="srsd_v1+mechanics_llm_v1",
        )
    )
    db.commit()

    return WritingProfileResponse(
        mechanics=mechanics,
        organization=organization,
        overall=overall,
        submission_id=str(submission.id),
    )
