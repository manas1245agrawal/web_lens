from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    GROQ_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    CONDENSE_MODEL: str = "llama-3.3-70b-versatile"
    EMBEDDINGS_PROVIDER: str = "local"  # local | openai
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    OPENAI_API_KEY: str = ""
    DATA_DIR: str = "./data"
    FULL_CONTEXT_MAX_TOKENS: int = 10000
    MAX_HISTORY_TOKENS: int = 3000
    MAX_MARKDOWN_CHARS: int = 300000
    PAGE_TTL_DAYS: int = 30
    ALLOWED_ORIGINS: str = "http://localhost,chrome-extension://*"
    APP_VERSION: str = "0.1.0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
