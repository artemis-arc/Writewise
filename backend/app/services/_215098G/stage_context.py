import threading
from dataclasses import dataclass, field


@dataclass(frozen=True)
class StageSignalRecord:
    stage: str
    confidence: float
    timestamp: float
    before_text: str = ""
    after_text: str = ""


@dataclass
class StageContextState:
    latest: StageSignalRecord | None = None
    history: list[StageSignalRecord] = field(default_factory=list)


@dataclass
class SessionStageContextState:
    latest: StageSignalRecord | None = None
    history: list[StageSignalRecord] = field(default_factory=list)


class StageContextStore:
    """Backend-owned in-memory record of the latest Module 2 outputs."""

    def __init__(self, history_limit: int = 100):
        if history_limit < 1:
            raise ValueError("history_limit must be at least 1")

        self._history_limit = history_limit
        self._lock = threading.Lock()
        self._sessions: dict[str, SessionStageContextState] = {}

    def _get_session_state(self, session_id: str) -> SessionStageContextState:
        return self._sessions.setdefault(session_id, SessionStageContextState())

    def record(
        self,
        session_id: str,
        stage: str,
        confidence: float,
        timestamp: float,
        before_text: str = "",
        after_text: str = "",
    ) -> StageSignalRecord:
        record = StageSignalRecord(
            stage=stage,
            confidence=confidence,
            timestamp=timestamp,
            before_text=before_text,
            after_text=after_text,
        )
        with self._lock:
            state = self._get_session_state(session_id)
            state.latest = record
            state.history.append(record)
            del state.history[: -self._history_limit]
        return record

    def snapshot(self, session_id: str) -> dict[str, object]:
        with self._lock:
            state = self._sessions.get(session_id)
            if state is None:
                return {"latest": None, "history": []}

            return {
                "latest": state.latest.__dict__
                if state.latest is not None
                else None,
                "history": [item.__dict__ for item in state.history],
            }
