"""
Where this module gets the writer it is generating feedback for.

Two jobs. The first is loading Module 1's (215131E) scores -- the profile is not the
caller's to assert, it is a row Module 1 already wrote to submission_scores, so it is
read back here rather than trusted off the request body.

The second is turning those scores into the categorical input this module's retrieval
needs: which writer level bucket they put the writer in. The other categorical input,
the writing stage, is Module 2's (215098G) output and is taken from the request as-is --
there is no derivation for it here. Module 2's classifier has not landed yet, so callers
pass one of the three stage literals explicitly.

Writer level did not exist as a derivation in the notebook either; it was hand-written
into every test input. It is here rather than in the request schema so that the mapping
is one documented rule instead of something each caller reinvents.
"""

import uuid

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.models import SubmissionScore, WritingSubmission
from app.models._215043K.schemas import WritingProfileScores

# Module 1 tags the submissions it scores with this; drafts saved from the editor share
# the table but never get a SubmissionScore row, so the fallback below has to exclude them.
PROFILE_UPLOAD_SOURCE = "writing_profile_upload"


class InvalidSubmissionIdError(ValueError):
    """submission_id was not a UUID. A 400, not a 404 -- it could never name a row."""


def load_profile_scores(
    db: Session,
    user_id: uuid.UUID,
    submission_id: str | None,
) -> WritingProfileScores | None:
    """
    Module 1's most recent scores for this writer, or None if it has never scored them.

    With a submission_id, the profile of that specific upload; without one, whatever the
    writer's latest profile upload scored. Either way the query is filtered by user_id,
    so one writer's submission_id cannot pull back another's profile.
    """
    query = (
        db.query(SubmissionScore)
        .join(WritingSubmission, WritingSubmission.id == SubmissionScore.submission_id)
        .filter(WritingSubmission.user_id == user_id)
    )

    if submission_id is not None:
        try:
            submission_uuid = uuid.UUID(submission_id)
        except ValueError as exc:
            raise InvalidSubmissionIdError(
                f"submission_id {submission_id!r} is not a valid UUID."
            ) from exc
        query = query.filter(WritingSubmission.id == submission_uuid)
    else:
        query = query.filter(WritingSubmission.source == PROFILE_UPLOAD_SOURCE)

    # A submission can accumulate score rows over time, so newest wins in both branches.
    score = query.order_by(desc(SubmissionScore.scored_at)).first()
    if score is None:
        return None

    # Numeric(5, 2) columns come back as Decimal; float() them here rather than leave
    # each caller to notice, the same way the history routes do.
    return WritingProfileScores(
        mechanics=float(score.mechanics),
        organization=float(score.organization),
        overall=float(score.overall),
    )


def resolve_writer_level(overall: float, low_cutoff: float, medium_cutoff: float) -> str:
    """
    Buckets Module 1's overall 0-100 score into the low/medium/high label the knowledge
    base is indexed by. The defaults sit in the gaps between the bands actually present
    in feedback_kb.json, whose examples cluster at means of 36-46, 57-65 and 78-83.
    """
    if overall < low_cutoff:
        return "low"
    if overall < medium_cutoff:
        return "medium"
    return "high"
