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
    srsd_max_upload_bytes: int = (
        25 * 1024 * 1024
    )  # 25MB, matching the Upload screen's stated limit

    # --- Module 2: writing stage classification (215098G) ---
    m2_model_path: Path = BASE_DIR / "data" / "215098G" / "model.joblib"
    m2_vectorizer_path: Path = (
        BASE_DIR / "data" / "215098G" / "vectorizer_tfidf_5k.joblib"
    )
    m2_scaler_path: Path = (
        BASE_DIR / "data" / "215098G" / "scaler_edit_structure.joblib"
    )
    m2_label_encoder_path: Path = BASE_DIR / "data" / "215098G" / "label_encoder.joblib"

    feedback_embedding_model: str = "all-MiniLM-L6-v2"

    # --- Module 3: feedback generation (215043K) ---
    # Named feedback_gen_* to stay clear of Module 4's own feedback_kb_path below.
    feedback_gen_kb_path: Path = BASE_DIR / "data" / "215043K" / "feedback_kb.json"
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

    # The writing stage is Module 2's (215098G) output and arrives on the request, so
    # there is nothing to configure for it here.

    # Module 1's overall score below which a writer is low / medium. The gaps in
    # feedback_kb.json's own examples sit at 46-57 and 65-78.
    feedback_writer_level_low_cutoff: float = 50.0
    feedback_writer_level_medium_cutoff: float = 70.0

    # --- Module 4: feedback scoring (215051H) ---
    feedback_kb_path: Path = BASE_DIR / "data" / "215051H" / "feedback_kb.json"
    clarity_semantic_model: str = "all-mpnet-base-v2"
    clarity_model_dir: Path = BASE_DIR / "data" / "215051H" / "clarity_model"

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
