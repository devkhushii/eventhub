# app/modules/auth/repository.py

from sqlalchemy.orm import Session  # type: ignore
from app.modules.auth.models import User, RefreshToken, EmailVerificationToken, PasswordResetToken


class AuthRepository:

    @staticmethod
    def get_user_by_email(db: Session, email: str):
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_user_by_id(db: Session, user_id):
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create_user(db: Session, user: User):
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def save_refresh_token(db: Session, token: RefreshToken):
        db.add(token)
        db.commit()

    @staticmethod
    def get_refresh_token(db: Session, token: str):
        return db.query(RefreshToken).filter(RefreshToken.token == token).first()

    @staticmethod
    def revoke_refresh_token(db: Session, token_obj: RefreshToken):
        token_obj.revoked = True
        db.commit()

    @staticmethod
    def save_verification_token(db: Session, token: EmailVerificationToken):
        db.add(token)
        db.commit()

    @staticmethod
    def get_verification_token(db: Session, token: str):
        return db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == token
        ).first()

    @staticmethod
    def save_password_reset_token(db: Session, token: PasswordResetToken):
        db.add(token)
        db.commit()

    @staticmethod
    def get_password_reset_token(db: Session, token: str):
        return db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token
        ).first()
