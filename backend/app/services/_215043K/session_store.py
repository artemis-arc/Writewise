import json
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.services._215043K.atomic_json import write_json_atomically


@dataclass
class SessionRecord:
    """One writing session's memory. Keyed by the opaque session_id the client sends."""

    feedback_history: list[str] = field(default_factory=list)
    last_state: int | None = None
    turns: int = 0
    updated_at: str = ""


class SessionStore:
    """
    Per-session memory for the feedback loop. The notebook had none: every call started
    cold, which is why feedback_history sat unused in all 50 knowledge base entries and
    consistency_with_history had nothing to score against.

    Kept in memory and mirrored to one JSON file so a restart mid-study does not wipe
    the histories the evaluation depends on.
    """

    def __init__(self, path: Path, history_limit: int):
        self._path = path
        self._history_limit = history_limit
        self._lock = threading.Lock()
        self._sessions: dict[str, SessionRecord] = self._load()

    def _load(self) -> dict[str, SessionRecord]:
        if not self._path.exists():
            return {}

        payload = json.loads(self._path.read_text(encoding="utf-8"))
        return {
            session_id: SessionRecord(**record)
            for session_id, record in payload.get("sessions", {}).items()
        }

    def get(self, session_id: str) -> SessionRecord:
        with self._lock:
            return self._sessions.get(session_id, SessionRecord())

    def record_turn(self, session_id: str, feedback: str, final_state: int) -> None:
        with self._lock:
            record = self._sessions.setdefault(session_id, SessionRecord())
            record.feedback_history.append(feedback)
            # Bounded so a long session cannot grow the file without limit; only the
            # most recent turns are ever read back anyway.
            del record.feedback_history[: -self._history_limit]
            record.last_state = final_state
            record.turns += 1
            record.updated_at = datetime.now(timezone.utc).isoformat()

            write_json_atomically(
                self._path,
                {
                    "sessions": {
                        key: asdict(value) for key, value in self._sessions.items()
                    }
                },
            )
