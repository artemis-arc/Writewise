from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.config import Settings, get_settings
from app.db.models import RefreshToken, User
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _issue_tokens(user: User, db: Session, settings: Settings) -> TokenResponse:
    access_token = create_access_token(user.id, settings)
    refresh_token, expires_at = create_refresh_token(user.id, settings)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    db.commit()

    return TokenResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        access_token_expires_in=settings.access_token_expire_minutes * 60,
        refresh_token=refresh_token,
        refresh_token_expires_in=settings.refresh_token_expire_days * 24 * 60 * 60,
    )


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _issue_tokens(user, db, settings)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return _issue_tokens(user, db, settings)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    token_hash = hash_token(payload.refresh_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if (
        record is None
        or record.revoked_at is not None
        or record.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=401, detail="Refresh token is invalid or expired.")

    user = db.get(User, record.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found.")

    # Rotate: revoke the used refresh token before issuing a new pair.
    record.revoked_at = datetime.now(timezone.utc)
    db.commit()

    return _issue_tokens(user, db, settings)


@router.post("/logout", status_code=204)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> None:
    token_hash = hash_token(payload.refresh_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        db.commit()


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
