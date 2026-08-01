import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    display_name: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow, nullable=False)

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    writing_submissions: Mapped[list["WritingSubmission"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    task_definitions: Mapped[list["TaskDefinition"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class TaskDefinition(Base):
    __tablename__ = "task_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task: Mapped[str] = mapped_column(Text, nullable=False)
    academic_level: Mapped[str] = mapped_column(nullable=False)
    citation_style: Mapped[str] = mapped_column(nullable=False, default="APA7")
    milestones_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    actions_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="task_definitions")
    writing_submissions: Mapped[list["WritingSubmission"]] = relationship(
        back_populates="task_definition"
    )


class WritingSubmission(Base):
    __tablename__ = "writing_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(nullable=False)  # 'writing_profile_upload' | 'editor_draft'
    original_filename: Mapped[str | None] = mapped_column(nullable=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    task_definition_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("task_definitions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="writing_submissions")
    task_definition: Mapped["TaskDefinition | None"] = relationship(
        back_populates="writing_submissions"
    )
    scores: Mapped[list["SubmissionScore"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )


class SubmissionScore(Base):
    __tablename__ = "submission_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("writing_submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mechanics: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    organization: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    overall: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    scored_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)
    scorer_version: Mapped[str | None] = mapped_column(nullable=True)

    submission: Mapped["WritingSubmission"] = relationship(back_populates="scores")
