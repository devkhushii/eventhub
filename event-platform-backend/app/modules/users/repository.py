# backend/app/modules/users/repository.py

from sqlalchemy.orm import Session             # type: ignore
from uuid import UUID
from typing import Optional, List

from .models import User


class UserRepository:
    @staticmethod
    def get_by_id(db: Session, user_id: UUID) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()
    @staticmethod
    def list_users(db: Session, skip: int = 0, limit: int = 10) -> List[User]:
        return db.query(User).offset(skip).limit(limit).all()
    @staticmethod
    def update_user(db: Session, user: User, data: dict) -> User:
        for key, value in data.items():
            setattr(user, key, value)

        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    @staticmethod
    def soft_delete(db: Session, user: User):
        user.is_active = False
        db.commit()
