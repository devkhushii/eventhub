from fastapi import Depends, HTTPException, status      # type: ignore
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials   # type: ignore
from sqlalchemy.orm import Session               # type: ignore

from app.db.session import get_db
from app.core.security import decode_token
from app.modules.users.models import User

security = HTTPBearer()


def get_current_user(
     db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(User).filter(User.id == payload.get("sub")).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


def require_role(allowed_roles: list[str]):
    """Consistent role checker — always compares uppercase."""
    def role_checker(user: User = Depends(get_current_user)):
        if user.role.upper() not in [role.upper() for role in allowed_roles]:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return role_checker


def get_current_admin_user(current_user: User = Depends(get_current_user)):
    """Consistent admin check — uses the same role field as require_role."""
    if current_user.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user
