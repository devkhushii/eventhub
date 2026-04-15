# app/modules/auth/router.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks  # type: ignore
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session  # type: ignore
import logging

logger = logging.getLogger(__name__)

from app.db.session import get_db
from app.modules.auth.schema import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    UserResponse,
)
from app.modules.auth.service import AuthService
from app.modules.auth.email_service import EmailService

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    print("=" * 80)
    print("!!! REGISTER ENDPOINT - START !!!")
    print("=" * 80)

    try:
        user, token = AuthService.register(
            db, request.email, request.full_name, request.password, request.role
        )

        print(f"User created: {user.email}")
        print(f"Token: {token[:20]}...")

        # FORCED SYNC EMAIL - NO BackgroundTasks
        print("Calling EmailService.send_verification_email...")
        await EmailService.send_verification_email(user.email, token)

        print("Email service returned!")
        print("=" * 80)
        print("!!! REGISTER ENDPOINT - COMPLETE !!!")
        print("=" * 80)

        return user

    except Exception as e:
        print(f"ERROR in register: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        access, refresh = AuthService.login(db, request.email, request.password)
        return TokenResponse(
            access_token=access, refresh_token=refresh, token_type="bearer"
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):
    try:
        access, refresh_token = AuthService.refresh(db, request.refresh_token)
        return TokenResponse(access_token=access, refresh_token=refresh_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    try:
        AuthService.verify_email(db, token)
        return {"message": "Email verified"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reset-password")
def validate_reset_token(token: str, db: Session = Depends(get_db)):
    try:
        AuthService.verify_reset_token(db, token)  # you need to implement this
        return {"message": "Token valid"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    token = AuthService.request_password_reset(db, request.email)

    if token:
        background_tasks.add_task(
            EmailService.send_password_reset_email, request.email, token
        )

    return {"message": "If this email exists, reset link has been sent."}


@router.post("/password-reset/confirm")
def confirm_reset(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    try:
        AuthService.reset_password(db, request.token, request.new_password)
        return {"message": "Password updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# DEBUG ENDPOINT: Test email delivery
@router.get("/test-email")
async def test_email():
    """Debug endpoint to test email delivery"""
    import secrets

    test_token = secrets.token_urlsafe(32)
    print("=" * 60)
    print("TEST EMAIL ENDPOINT CALLED")
    print("=" * 60)

    try:
        await EmailService.send_verification_email(
            "devkhushii.16@gmail.com", test_token
        )
        return {"message": "Test email sent successfully", "token": test_token}
    except Exception as e:
        print(f"TEST EMAIL FAILED: {str(e)}")
        return {"message": "Test email failed", "error": str(e)}, 500
