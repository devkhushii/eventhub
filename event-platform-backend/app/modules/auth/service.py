# app/modules/auth/service.py

import logging
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session         # type: ignore

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.modules.auth.models import User, RefreshToken, EmailVerificationToken, PasswordResetToken
from app.modules.auth.repository import AuthRepository

logger = logging.getLogger(__name__)


class AuthService:

    ACCESS_TOKEN_EXPIRE_MINUTES = 15
    REFRESH_TOKEN_EXPIRE_DAYS = 7

    @staticmethod
    def register(db: Session, email: str, full_name: str, password: str, role):
        if AuthRepository.get_user_by_email(db, email):
            raise Exception("Email already registered")

        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            role=role,
        )

        user = AuthRepository.create_user(db, user)

        # create email verification token
        token = secrets.token_urlsafe(32)
        verification = EmailVerificationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        )
        AuthRepository.save_verification_token(db, verification)

        return user, token

    @staticmethod
    def login(db: Session, email: str, password: str):
        user = AuthRepository.get_user_by_email(db, email)
        if not user:
            raise Exception("Invalid credentials")

        if not verify_password(password, user.password_hash):
            raise Exception("Invalid credentials")

        if not user.is_verified:
            raise Exception("Email not verified")

        if not user.is_active:
            raise Exception("Account is deactivated")

        access_token = create_access_token(
            {"sub": str(user.id), "role": user.role}
        )

        refresh_token_value = secrets.token_urlsafe(64)

        refresh_token = RefreshToken(
            user_id=user.id,
            token=refresh_token_value,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=AuthService.REFRESH_TOKEN_EXPIRE_DAYS)
        )

        AuthRepository.save_refresh_token(db, refresh_token)

        return access_token, refresh_token_value

    @staticmethod
    def refresh(db: Session, refresh_token: str):
        token_obj = AuthRepository.get_refresh_token(db, refresh_token)

        if not token_obj or token_obj.revoked:
            raise Exception("Invalid refresh token")

        if token_obj.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise Exception("Refresh token expired")

        user = token_obj.user

        # rotate token
        AuthRepository.revoke_refresh_token(db, token_obj)

        new_access = create_access_token(
            {"sub": str(user.id), "role": user.role}
        )

        new_refresh_value = secrets.token_urlsafe(64)
        new_refresh = RefreshToken(
            user_id=user.id,
            token=new_refresh_value,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=AuthService.REFRESH_TOKEN_EXPIRE_DAYS)
        )

        AuthRepository.save_refresh_token(db, new_refresh)

        return new_access, new_refresh_value

    @staticmethod
    def verify_email(db: Session, token: str):
        token_obj = AuthRepository.get_verification_token(db, token)
        if not token_obj or token_obj.used:
            raise Exception("Invalid token")

        if token_obj.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise Exception("Token expired")

        user = AuthRepository.get_user_by_id(db, token_obj.user_id)
        user.is_verified = True
        token_obj.used = True

        db.commit()

    @staticmethod
    def request_password_reset(db: Session, email: str):
        user = AuthRepository.get_user_by_email(db, email)
        if not user:
            return  # don't reveal existence

        token = secrets.token_urlsafe(32)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
        )

        AuthRepository.save_password_reset_token(db, reset_token)

        return token

    @staticmethod
    def reset_password(db: Session, token: str, new_password: str):
        token_obj = AuthRepository.get_password_reset_token(db, token)

        if not token_obj or token_obj.used:
            raise Exception("Invalid token")

        if token_obj.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise Exception("Token expired")

        user = AuthRepository.get_user_by_id(db, token_obj.user_id)
        user.password_hash = hash_password(new_password)
        token_obj.used = True

        db.commit()
