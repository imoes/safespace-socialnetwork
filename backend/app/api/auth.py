from datetime import timedelta

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.models.schemas import UserCreate, UserLogin, Token, UserProfile
from app.services.auth_service import (
    authenticate_user,
    register_user,
    create_access_token,
    get_current_user
)
from app.config import settings
from app.db.postgres import get_user_by_username


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Registriert einen neuen User und gibt einen JWT Token zurück"""

    # Prüfen ob Username bereits existiert
    existing = await get_user_by_username(user_data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    user = await register_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        first_name=user_data.first_name,
        last_name=user_data.last_name
    )

    # JWT Token erstellen (wie beim Login)
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user["uid"])},  # JWT standard requires sub to be a string
        expires_delta=access_token_expires
    )

    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login mit Username und Passwort.
    Gibt JWT Token zurück.
    """
    user = await authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user["uid"])},  # JWT standard requires sub to be a string
        expires_delta=access_token_expires
    )
    return Token(access_token=access_token)


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Gibt den aktuellen User zurück"""
    return UserProfile(
        uid=current_user["uid"],
        username=current_user["username"],
        email=current_user["email"],
        role=current_user.get("role", "user"),
        bio=current_user.get("bio"),
        created_at=current_user["created_at"]
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout - im Moment nur clientseitig relevant.
    Bei Bedarf kann hier Token-Blacklisting implementiert werden.
    """
    return {"message": "Successfully logged out"}
