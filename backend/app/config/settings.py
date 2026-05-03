import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    # Server
    port: int = 8000
    node_env: str = "development"

    # Database
    database_url: str = "postgresql://postgres:GabLintong02@localhost:5432/smart_parking"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # JWT
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    # CORS
    cors_origin: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "allow"  # Allow extra fields from .env that we don't use (e.g. MONGO_URL)


settings = Settings()
