from datetime import timedelta, datetime, date
import secrets

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
from app.db.postgres import get_user_by_username, get_user_by_email, PostgresDB
from app.db.notifications import create_notification


router = APIRouter(prefix="/auth", tags=["Authentication"])


def calculate_age(birthday: date) -> int:
    today = date.today()
    age = today.year - birthday.year
    if (today.month, today.day) < (birthday.month, birthday.day):
        age -= 1
    return age


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Registriert einen neuen User und gibt einen JWT Token zurück"""

    # Altersprüfung
    age = calculate_age(user_data.birthday)

    if age < 13:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Minimum age is 13"
        )

    if age < 16 and not user_data.parent_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parental consent required"
        )

    if user_data.parent_email and user_data.parent_email == user_data.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent email must be different from your own email"
        )

    # Prüfen ob Username bereits existiert
    existing = await get_user_by_username(user_data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Prüfen ob E-Mail bereits existiert
    existing_email = await get_user_by_email(user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    is_minor = age < 18

    user = await register_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        birthday=str(user_data.birthday)
    )

    # is_minor Flag setzen
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET last_login = %s, is_minor = %s WHERE uid = %s",
            (datetime.utcnow(), is_minor, user["uid"])
        )
        await conn.commit()

    # Bei 13-15: Eltern-Einwilligung anfordern, Account ist bis dahin gesperrt
    if age < 16 and user_data.parent_email:
        consent_token = secrets.token_urlsafe(48)
        async with PostgresDB.connection() as conn:
            await conn.execute(
                """INSERT INTO parental_consents (user_uid, parent_email, consent_token)
                   VALUES (%s, %s, %s)""",
                (user["uid"], user_data.parent_email, consent_token)
            )
            # Account als wartend auf Einwilligung markieren
            await conn.execute(
                "UPDATE users SET parental_consent_pending = TRUE WHERE uid = %s",
                (user["uid"],)
            )
            await conn.commit()

        # E-Mail an Eltern senden
        try:
            from app.services.email_service import EmailService
            from app.db.site_settings import get_site_url
            site_url = await get_site_url()
            consent_link = f"{site_url}/parental-consent/{consent_token}"

            await EmailService.send_parental_consent_email(
                parent_email=user_data.parent_email,
                child_username=user_data.username,
                consent_link=consent_link
            )
        except Exception as e:
            print(f"Error sending parental consent email: {e}")

    # Willkommens-Benachrichtigung erstellen
    await create_notification(
        user_uid=user["uid"],
        actor_uid=user["uid"],
        notification_type="welcome"
    )

    # JWT Token erstellen (wie beim Login)
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user["uid"])},
        expires_delta=access_token_expires
    )

    return Token(access_token=access_token)


@router.get("/parental-consent/{token}")
async def verify_parental_consent(token: str):
    """Bestätigt die elterliche Einwilligung über den E-Mail-Link"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT pc.id, pc.user_uid, pc.confirmed
               FROM parental_consents pc
               WHERE pc.consent_token = %s""",
            (token,)
        )
        row = await result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Invalid consent token")

        if row["confirmed"]:
            return {"message": "Consent already confirmed", "already_confirmed": True}

        await conn.execute(
            "UPDATE parental_consents SET confirmed = TRUE, confirmed_at = %s WHERE id = %s",
            (datetime.utcnow(), row["id"])
        )
        await conn.execute(
            "UPDATE users SET parental_consent_pending = FALSE WHERE uid = %s",
            (row["user_uid"],)
        )
        await conn.commit()

    return {"message": "Parental consent confirmed", "confirmed": True}


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

    # Prüfen ob elterliche Einwilligung aussteht
    if user.get("parental_consent_pending"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parental consent pending"
        )

    # Update last_login timestamp
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET last_login = %s WHERE uid = %s",
            (datetime.utcnow(), user["uid"])
        )
        await conn.commit()

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
        created_at=current_user["created_at"],
        profile_picture=current_user.get("profile_picture"),
        first_name=current_user.get("first_name"),
        last_name=current_user.get("last_name"),
        preferred_language=current_user.get("preferred_language"),
        birthday=current_user.get("birthday")
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout - im Moment nur clientseitig relevant.
    Bei Bedarf kann hier Token-Blacklisting implementiert werden.
    """
    return {"message": "Successfully logged out"}
