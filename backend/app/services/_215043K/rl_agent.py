import random
from itertools import product

import numpy as np

from app.services._215043K.q_table_store import QTableStore
from app.services._215043K.retriever import STAGES

# The six measures Module 4 scores a piece of feedback on, in the fixed order that
# defines the bit layout of a state id. Reordering this renumbers every state and
# invalidates any saved Q-table.
METRICS = (
    "relevance",
    "clarity",
    "actionability",
    "stage_alignment",
    "improvement_impact",
    "consistency_with_history",
)

# Threshold aligned with WRFEF's boundary between "adequate/below" and "good/excellent".
BAND_THRESHOLD = 0.7

# State = writing stage x the six measures banded to low/high, so 3 * 2^6 = 192.
N_STATES = len(STAGES) * 2 ** len(METRICS)

NO_ACTION = "No additional instruction"

ACTIONS = (
    NO_ACTION,
    "Give one clear, specific next step the student can act on immediately",
    "Explicitly connect the suggestion to the student's own written content",
    "Use simple, direct wording; avoid abstract phrasing",
    "Keep the feedback to one or two sentences",
    "Explicitly match the instruction to the student's current writing stage",
    "Include one brief illustrative example of the suggested action",
    "Build on the previous feedback instead of introducing an unrelated idea",
    "Break the suggested action into a short step-by-step sequence",
    "Acknowledge one specific strength before suggesting the improvement",
    "Apply the SRSD strategy matched to the current stage",
    "Briefly explain why this change will improve the next draft",
    "Use encouraging, supportive language",
    "Combine encouragement with corrective guidance",
)

NO_ACTION_INDEX = ACTIONS.index(NO_ACTION)

# Weights and gates from calculate_reward() in the notebook: a single measure below the
# floor fails the feedback outright, otherwise the weighted average has to clear the band.
REWARD_WEIGHTS = {
    "relevance": 1.0,
    "clarity": 1.0,
    "actionability": 1.5,
    "stage_alignment": 1.5,
    "improvement_impact": 1.0,
    "consistency_with_history": 1.0,
}
REWARD_FLOOR = 0.3


def band(score: float) -> int:
    return 1 if score >= BAND_THRESHOLD else 0


def is_fully_banded(scores: dict[str, float]) -> bool:
    """True when all six measures are already 'high' -- the agent has nothing to fix."""
    return all(band(scores[metric]) == 1 for metric in METRICS)


def get_state_id(stage: str, scores: dict[str, float]) -> int:
    """Pack (stage, six bands) into 0-191. Bit order follows METRICS, MSB first."""
    stage_index = STAGES.index(stage)
    bits = "".join(str(band(scores[metric])) for metric in METRICS)
    return stage_index * 2 ** len(METRICS) + int(bits, 2)


def describe_state(state_id: int) -> dict:
    """Inverse of get_state_id, for logging and for inspecting a trained table."""
    block = 2 ** len(METRICS)
    stage = STAGES[state_id // block]
    bits = format(state_id % block, f"0{len(METRICS)}b")
    return {"stage": stage, **{metric: int(bit) for metric, bit in zip(METRICS, bits)}}


def all_states() -> list[dict]:
    """The 192 environments enumerated in the notebook, rebuilt from the same product()."""
    environments = []
    for stage_index, stage in enumerate(STAGES):
        for bits in product([0, 1], repeat=len(METRICS)):
            environments.append(
                {
                    "environment": stage_index * 2 ** len(METRICS) + int("".join(map(str, bits)), 2),
                    "stage": stage,
                    **dict(zip(METRICS, bits)),
                }
            )
    return environments


def calculate_reward(scores: dict[str, float]) -> int:
    if any(scores[metric] < REWARD_FLOOR for metric in REWARD_WEIGHTS):
        return -1
    weighted = sum(scores[metric] * weight for metric, weight in REWARD_WEIGHTS.items())
    return 1 if weighted / sum(REWARD_WEIGHTS.values()) >= BAND_THRESHOLD else -1


class RLAgent:
    """
    Tabular Q-learning over (state, action), ported from the notebook's get_best_action /
    learn_RL pair. The only structural change is that Q lives in a QTableStore so updates
    outlive the process, which is what "online learning" needs to mean for a server.
    """

    def __init__(
        self,
        store: QTableStore,
        alpha: float,
        gamma: float,
        epsilon: float,
        seed: int | None = None,
    ):
        self._store = store
        self._alpha = alpha
        self._gamma = gamma
        self._epsilon = epsilon
        self._random = random.Random(seed)

    @property
    def q_table(self) -> np.ndarray:
        return self._store.table

    def select_action(self, state: int) -> int:
        row = self._store.table[state]

        if np.all(row == 0):
            # Never learned from this state -- take the no-op rather than gambling on an
            # untested instruction, which is also the cheaper mistake pedagogically.
            return NO_ACTION_INDEX
        if self._random.random() < self._epsilon:
            return self._random.randrange(len(ACTIONS))
        return int(np.argmax(row))

    def learn(self, scores: dict[str, float], state: int, action: int, next_state: int) -> int:
        """Applies the Q-update and returns the reward it was driven by."""
        reward = calculate_reward(scores)
        table = self._store.table

        current = table[state, action]
        updated = current + self._alpha * (
            reward + self._gamma * float(np.max(table[next_state])) - current
        )
        self._store.update(state, action, updated)
        return reward
