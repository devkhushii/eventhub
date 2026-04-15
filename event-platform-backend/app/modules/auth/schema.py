# app/modules/auth/schemas.py

from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator   # type: ignore
from typing import Optional


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: Optional[str] = "CUSTOMER"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = ["CUSTOMER", "VENDOR", "MANAGER"]
        if v.upper() not in allowed:
            raise ValueError(f"Role must be one of: {allowed}")
        return v.upper()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class EmailVerificationRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: Optional[str] = "CUSTOMER"
    is_verified: bool

    class Config:
        from_attributes = True
