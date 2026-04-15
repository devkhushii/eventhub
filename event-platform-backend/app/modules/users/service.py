# backend/app/modules/users/service.py

from sqlalchemy.orm import Session                 # type: ignore
from uuid import UUID
from typing import List
from .repository import UserRepository
from .schema import UserUpdate
from fastapi import HTTPException, status                # type: ignore


class UserService:

    def __init__(self):
        self.repo = UserRepository()

    def get_user(self, db: Session, user_id: UUID):
        user = self.repo.get_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def update_user(self, db: Session, user_id: UUID, data: UserUpdate):
        user = self.get_user(db, user_id)
        return self.repo.update_user(db, user, data.model_dump(exclude_unset=True))

    def list_users(self, db: Session, skip: int, limit: int):
        return self.repo.list_users(db, skip, limit)

    def deactivate_user(self, db: Session, user_id: UUID):
        user = self.get_user(db, user_id)
        self.repo.soft_delete(db, user)
        return {"message": "User deactivated successfully"}
