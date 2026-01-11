import os
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys
    openai_api_key: str = ""
    fal_key: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # Directories
    upload_dir: Path = Path("uploads")
    output_dir: Path = Path("outputs")
    cache_dir: Path = Path("cache")

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # Generation defaults
    default_texture_size: int = 1024
    default_mesh_simplify: float = 0.95

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


def init_directories() -> None:
    """Create required directories."""
    settings = get_settings()
    settings.upload_dir.mkdir(exist_ok=True)
    settings.output_dir.mkdir(exist_ok=True)
    settings.cache_dir.mkdir(exist_ok=True)
