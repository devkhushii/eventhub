import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.shared.exceptions import BaseAppException
from app.db.init_db import init_db
from app.api.v1.router import api_router

# CRITICAL: Import all models early to register them with SQLAlchemy
# This ensures all models are loaded in both FastAPI app AND Celery worker
import app.db.models  # noqa: F401

settings = get_settings()

# ---------------------------------------------------
# Setup Logging
# ---------------------------------------------------
setup_logging()
logger = logging.getLogger(__name__)

from app.db.session import engine
from app.db.base import Base


# ---------------------------------------------------
# Lifespan (Startup / Shutdown)
# ---------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting EventHub Application...")

    # Initialize database (create tables / seed roles)
    init_db()

    logger.info("Application startup complete.")
    yield

    logger.info("Shutting down EventHub Application...")


# ---------------------------------------------------
# Create FastAPI App
# ---------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Event Management Platform Backend API",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
    debug=settings.DEBUG,
    # root_path="/api",
)

# Disable automatic redirect on trailing slashes
app.router.redirect_slashes = False


# ---------------------------------------------------
# CORS Middleware
# ---------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------
# Static Files (serve uploaded images)
# ---------------------------------------------------
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ---------------------------------------------------
# Global Exception Handler
# ---------------------------------------------------
@app.exception_handler(BaseAppException)
async def base_exception_handler(request: Request, exc: BaseAppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception occurred")

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
        },
    )


# ---------------------------------------------------
# API Router
# ---------------------------------------------------
app.include_router(api_router, prefix="/api/v1")


# ---------------------------------------------------
# WebSocket for Real-time Chat
# ---------------------------------------------------
from app.modules.chat.websocket import websocket_endpoint


@app.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    await websocket_endpoint(websocket, conversation_id)


# ---------------------------------------------------
# WebSocket for Real-time Notifications
# ---------------------------------------------------
from app.modules.notifications.websocket_manager import notification_manager
from app.core.dependencies import get_current_user


@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications."""
    try:
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001)
            return

        from app.core.security import decode_token

        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4001)
            return

        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return

        await notification_manager.connect(websocket, user_id)
        logger.info(f"[WS] User {user_id} connected for notifications")

        try:
            while True:
                await websocket.receive_text()
        except Exception:
            pass
    finally:
        notification_manager.disconnect(
            websocket, user_id if "user_id" in locals() else ""
        )
        logger.info(f"[WS] User disconnected from notifications")


# ---------------------------------------------------
# Health Check
# ---------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
    }
