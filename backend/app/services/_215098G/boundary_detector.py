import logging
import threading
from dataclasses import dataclass

from app.services._215098G.stage_context import StageContextStore


@dataclass(frozen=True)
class BoundaryTriggerRecord:
    session_id: str
    timestamp: float
    before_text: str
    stage_before_transition: str
    stage_after_transition: str
    pause_seconds: float


class BoundaryDetector:
    """Rule-based pause detector for Module 2 stage transitions."""

    def __init__(
        self,
        stage_context: StageContextStore,
        pause_threshold: float,
        logger: logging.Logger | None = None,
    ):
        if pause_threshold < 0:
            raise ValueError("pause_threshold must be non-negative")

        self._stage_context = stage_context
        self._pause_threshold = pause_threshold
        self._logger = logger or logging.getLogger("uvicorn.error")
        self._lock = threading.Lock()
        self._latest_triggers: dict[str, BoundaryTriggerRecord] = {}

    def detect(self, session_id: str) -> BoundaryTriggerRecord | None:
        snapshot = self._stage_context.snapshot(session_id)
        history = snapshot["history"]
        if len(history) < 2:
            return None

        previous = history[-2]
        current = history[-1]

        if current["stage"] == previous["stage"]:
            return None

        pause_seconds = float(current["timestamp"]) - float(previous["timestamp"])
        if pause_seconds < self._pause_threshold:
            return None

        trigger = BoundaryTriggerRecord(
            session_id=session_id,
            timestamp=float(current["timestamp"]),
            before_text=str(current["before_text"]),
            stage_before_transition=str(previous["stage"]),
            stage_after_transition=str(current["stage"]),
            pause_seconds=pause_seconds,
        )

        with self._lock:
            self._latest_triggers[session_id] = trigger

        self._logger.info(
            "Module 2 boundary detected: session_id=%s timestamp=%s stage_before_transition=%s new_stage=%s pause_seconds=%.3f",
            trigger.session_id,
            trigger.timestamp,
            trigger.stage_before_transition,
            trigger.stage_after_transition,
            trigger.pause_seconds,
        )

        return trigger

    def latest_trigger(self, session_id: str) -> BoundaryTriggerRecord | None:
        with self._lock:
            return self._latest_triggers.get(session_id)
