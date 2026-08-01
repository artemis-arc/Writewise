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

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
