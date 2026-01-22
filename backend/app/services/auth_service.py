from datetime import datetime, timedelta
from typing import Optional
import hashlib

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config import settings
from app.db.postgres import get_user_by_username, get_user_by_uid, create_user
from app.models.schemas import TokenData
from app.cache.redis_cache import OnlineStatus


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifiziert Passwort gegen Hash"""
    # Truncate password to 72 bytes für bcrypt
    truncated = _truncate_password(plain_password)
    return pwd_context.verify(truncated, hashed_password)


def get_password_hash(password: str) -> str:
    """Erstellt Passwort-Hash"""
    # Truncate password to 72 bytes für bcrypt
    truncated = _truncate_password(password)
    return pwd_context.hash(truncated)


def _truncate_password(password: str) -> str:
    """
    Truncates password to 72 bytes for bcrypt compatibility.
    Uses SHA256 pre-hash for long passwords to maintain security.
    """
    # Wenn Password zu lang ist (>72 bytes), SHA256 pre-hash verwenden
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # SHA256 pre-hash für lange Passwörter
        return hashlib.sha256(password_bytes).hexdigest()[:72]
    return password


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Erstellt JWT Token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm
    )
    return encoded_jwt


async def authenticate_user(username: str, password: str) -> dict | None:
    """Authentifiziert User mit Username und Passwort"""
    user = await get_user_by_username(username)
    
    if not user:
        return None
    
    if not verify_password(password, user["password_hash"]):
        return None
    
    return user


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Holt aktuellen User aus JWT Token"""
    print(f"[AUTH] get_current_user called with token: {token[:20] if token else 'None'}...")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Disable strict validation of subject type to handle both old (int) and new (str) tokens
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            options={"verify_sub": False}
        )
        sub = payload.get("sub")
        print(f"[AUTH] Decoded token, sub: {sub} (type: {type(sub).__name__})")

        if sub is None:
            print("[AUTH] ERROR: sub is None in token payload")
            raise credentials_exception

        # Handle both string and integer sub claims (for backwards compatibility)
        if isinstance(sub, str):
            uid: int = int(sub)
        elif isinstance(sub, int):
            uid: int = sub
        else:
            print(f"[AUTH] ERROR: Invalid sub type: {type(sub)}")
            raise credentials_exception

        token_data = TokenData(uid=uid)

    except (JWTError, ValueError) as e:
        print(f"[AUTH] ERROR: JWT decode/parsing failed: {str(e)}")
        raise credentials_exception
    
    user = await get_user_by_uid(token_data.uid)
    
    if user is None:
        raise credentials_exception
    
    # User als online markieren
    await OnlineStatus.set_online(user["uid"])
    
    return user


async def register_user(username: str, email: str, password: str) -> dict:
    """Registriert neuen User"""
    # Prüfen ob Username bereits existiert
    existing = await get_user_by_username(username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Password hashen
    password_hash = get_password_hash(password)
    
    # User erstellen
    user = await create_user(username, email, password_hash)
    return user
