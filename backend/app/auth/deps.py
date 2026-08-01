import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth.security import TOKEN_TYPE_ACCESS, decode_token
from app.core.config import Settings, get_settings
from app.db.models import User
from app.db.session import get_db

ACCESS_COOKIE_NAME = "ww_access"
REFRESH_COOKIE_NAME = "ww_refresh"


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if token:
        return token

    authorization = request.headers.get("Authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]

    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_token(token, settings)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise HTTPException(status_code=401, detail="Invalid token type")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token payload") from exc

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user
