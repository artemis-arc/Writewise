from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Reads from environment variables / .env. Mirrors the models used in task_define.ipynb."""

    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    embedding_model: str = "all-MiniLM-L6-v2"
    scenarios_path: Path = BASE_DIR / "data" / "215131E" / "scenarios.json"
    action_bank_path: Path = BASE_DIR / "data" / "215131E" / "action_bank.json"
    cors_origins: list[str] = ["http://localhost:3000"]

    srsd_embedding_model: str = "BAAI/bge-large-en-v1.5"
    srsd_dataset_path: Path = BASE_DIR / "data" / "215131E" / "srsd_dataset.json"
    srsd_checkpoint_path: Path = BASE_DIR / "data" / "215131E" / "srsd_model.pt"
    srsd_max_upload_bytes: int = 25 * 1024 * 1024  # 25MB, matching the Upload screen's stated limit

    # --- Module 3: feedback generation (215043K) ---
    feedback_embedding_model: str = "all-MiniLM-L6-v2"
    feedback_kb_path: Path = BASE_DIR / "data" / "215043K" / "feedback_kb.json"
    feedback_strategy_kb_path: Path = BASE_DIR / "data" / "215043K" / "strategy_kb.json"

    # Learned online and written back on every turn, so unlike the other modules' data
    # files these two are runtime state rather than checked-in artifacts.
    feedback_q_table_path: Path = BASE_DIR / "data" / "215043K" / "q_table.json"
    feedback_sessions_path: Path = BASE_DIR / "data" / "215043K" / "sessions.json"
    feedback_session_history_limit: int = 20

    # Q-learning hyperparameters, as tuned in Feedback_Generation_Module.ipynb.
    feedback_alpha: float = 0.1
    feedback_gamma: float = 0.9
    feedback_epsilon: float = 0.2
    feedback_rl_seed: int | None = None  # set to make action selection reproducible

    # Fraction of Module 1's milestones completed at which the writer is treated as
    # having moved on to the next stage.
    feedback_planning_cutoff: float = 1 / 3
    feedback_implementation_cutoff: float = 2 / 3

    # Mean of Module 2's three scores below which a writer is low / medium. The gaps in
    # feedback_kb.json's own examples sit at 46-57 and 65-78.
    feedback_writer_level_low_cutoff: float = 50.0
    feedback_writer_level_medium_cutoff: float = 70.0

    # Module 4 scores each generated piece of feedback; those scores are the RL reward.
    module4_base_url: str = "http://localhost:8000"
    module4_evaluate_path: str = "/api/v1/feedback-evaluation"
    module4_timeout_seconds: float = 30.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
