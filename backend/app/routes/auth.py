"""Authentication routes — login & current user profile."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User
from app.middleware.auth import verify_password, create_access_token, get_current_user
from app.schemas.schemas import (
    LoginRequest,
    LoginResponse,
    UserResponse,
    ErrorResponse,
    SuccessResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Admin login",
    description="Validate admin/operator credentials and issue a JWT token.",
    responses={
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
        403: {"model": ErrorResponse, "description": "Account is inactive"},
    },
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": "Invalid username or password", "error_code": "INVALID_CREDENTIALS"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "message": "Account is deactivated", "error_code": "ACCOUNT_INACTIVE"},
        )

    token = create_access_token(data={"sub": user.id, "role": user.role})

    return LoginResponse(
        data={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "token": token,
        }
    )


@router.get(
    "/me",
    response_model=SuccessResponse,
    summary="Current user profile",
    description="Return the profile of the authenticated user.",
    responses={401: {"description": "Not authenticated"}},
)
def get_me(current_user: User = Depends(get_current_user)):
    return SuccessResponse(
        data={
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "role": current_user.role,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at,
        }
    )
