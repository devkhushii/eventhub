from pydantic_settings import BaseSettings  # type: ignore
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "Event Management API"
    # VERSION: str = "1.0.0"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    # Database
    # POSTGRES_SERVER: str
    # POSTGRES_USER: str
    # POSTGRES_PASSWORD: str
    # POSTGRES_DB: str
    # POSTGRES_PORT: int = 5432
    DATABASE_URL: str

    # # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_STARTTLS: bool
    MAIL_SSL_TLS: bool

    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Celery Background Tasks
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"

    # Email
    # SMTP_HOST: str
    # SMTP_PORT: int
    # SMTP_USER: str
    # SMTP_PASSWORD: str
    # EMAIL_FROM: str

    # CORS
    # BACKEND_CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
