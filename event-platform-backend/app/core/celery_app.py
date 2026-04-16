import os
from celery import Celery  # type: ignore
from app.core.config import settings

# CRITICAL: Import all models BEFORE importing tasks
# This ensures Base.metadata knows about all models and their relationships
# Without this, Celery worker fails with:
# InvalidRequestError: expression 'User' failed to locate a name ('User')
import app.db.models  # noqa: F401

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.modules.tasks"],
)


celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
