import threading
from dataclasses import dataclass, field


@dataclass(frozen=True)
class StageSignalRecord:
    stage: str
    confidence: float
    timestamp: float


@dataclass
class StageContextState:
    latest: StageSignalRecord | None = None
    history: list[StageSignalRecord] = field(default_factory=list)


class StageContextStore:
    """Backend-owned in-memory record of the latest Module 2 outputs."""

    def __init__(self, history_limit: int = 100):
        if history_limit < 1:
            raise ValueError("history_limit must be at least 1")

        self._history_limit = history_limit
        self._lock = threading.Lock()
        self._state = StageContextState()

    def record(
        self, stage: str, confidence: float, timestamp: float
    ) -> StageSignalRecord:
        record = StageSignalRecord(
            stage=stage, confidence=confidence, timestamp=timestamp
        )
        with self._lock:
            self._state.latest = record
            self._state.history.append(record)
            del self._state.history[: -self._history_limit]
        return record

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            return {
                "latest": self._state.latest.__dict__
                if self._state.latest is not None
                else None,
                "history": [item.__dict__ for item in self._state.history],
            }
