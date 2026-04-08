from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "QnA PDF Assistant"
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    database_url: str = "sqlite:///./qna.db"

    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"

    max_pdf_bytes: int = 15 * 1024 * 1024
    max_extracted_chars: int = 120_000
    max_documents_per_question: int = 20
    max_multi_search_chars: int = 100_000


@lru_cache
def get_settings() -> Settings:
    return Settings()
