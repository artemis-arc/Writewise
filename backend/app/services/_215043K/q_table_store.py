import json
import threading
from pathlib import Path

import numpy as np

from app.services._215043K.atomic_json import write_json_atomically


class QTableStore:
    """
    Load/save for the Q-table. The notebook held Q in a module-level numpy array that
    vanished when the runtime restarted; serving it means it has to survive restarts and
    tolerate concurrent requests.

    Every update is flushed immediately rather than batched -- batching buys nothing
    here, because each update follows four Gemini calls that dominate the cost of the
    request by orders of magnitude.
    """

    def __init__(self, path: Path, n_states: int, n_actions: int):
        self._path = path
        self._n_states = n_states
        self._n_actions = n_actions
        # FastAPI serves sync routes from a threadpool, so two requests really can land
        # in update() at once; without this their read-modify-write cycles interleave.
        self._lock = threading.Lock()
        self._table = self._load()

    def _load(self) -> np.ndarray:
        if not self._path.exists():
            return np.zeros((self._n_states, self._n_actions), dtype=np.float64)

        payload = json.loads(self._path.read_text(encoding="utf-8"))
        table = np.asarray(payload["q_table"], dtype=np.float64)

        expected = (self._n_states, self._n_actions)
        if table.shape != expected:
            # Almost always means the action list was edited after training: every
            # column index in the saved table now refers to a different instruction.
            raise ValueError(
                f"Q-table at {self._path} has shape {table.shape}, expected {expected}. "
                "The state or action space changed -- retrain rather than reusing it."
            )
        return table

    @property
    def table(self) -> np.ndarray:
        return self._table

    def update(self, state: int, action: int, value: float) -> None:
        with self._lock:
            self._table[state, action] = value
            write_json_atomically(
                self._path,
                {
                    "n_states": self._n_states,
                    "n_actions": self._n_actions,
                    "q_table": self._table.tolist(),
                },
            )
