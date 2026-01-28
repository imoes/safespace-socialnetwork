"""Password Reset API - Token-basiertes Passwort zurücksetzen"""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.db.postgres import PostgresDB, get_user_by_email
from app.services.auth_service import get_password_hash
from app.services.email_service import EmailService
from app.db.site_settings import get_site_url, get_site_title


router = APIRouter(prefix="/auth/password-reset", tags=["Password Reset"])

# Token-Gültigkeit: 1 Stunde
TOKEN_EXPIRY_HOURS = 1


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


async def init_password_reset_table():
    """Erstellt die password_reset_tokens Tabelle"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                token VARCHAR(64) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)
        """)
        await conn.commit()


async def create_reset_token(user_uid: int) -> str:
    """Erstellt einen neuen Reset-Token für einen User"""
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)

    async with PostgresDB.connection() as conn:
        # Alte unbenutzte Tokens für diesen User löschen
        await conn.execute(
            "DELETE FROM password_reset_tokens WHERE user_uid = %s AND used_at IS NULL",
            (user_uid,)
        )

        # Neuen Token erstellen
        await conn.execute(
            """
            INSERT INTO password_reset_tokens (user_uid, token, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user_uid, token, expires_at)
        )
        await conn.commit()

    return token


async def verify_reset_token(token: str) -> Optional[int]:
    """
    Prüft ob ein Reset-Token gültig ist.
    Returns: user_uid wenn gültig, None wenn ungültig/abgelaufen
    """
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT user_uid, expires_at, used_at
            FROM password_reset_tokens
            WHERE token = %s
            """,
            (token,)
        )
        row = await result.fetchone()

        if not row:
            return None

        # Bereits benutzt?
        if row["used_at"] is not None:
            return None

        # Abgelaufen?
        if row["expires_at"] < datetime.utcnow():
            return None

        return row["user_uid"]


async def mark_token_used(token: str):
    """Markiert einen Token als benutzt"""
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE password_reset_tokens SET used_at = %s WHERE token = %s",
            (datetime.utcnow(), token)
        )
        await conn.commit()


async def update_user_password(user_uid: int, password_hash: str):
    """Aktualisiert das Passwort eines Users"""
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET password_hash = %s WHERE uid = %s",
            (password_hash, user_uid)
        )
        await conn.commit()


@router.post("/request")
async def request_password_reset(data: PasswordResetRequest):
    """
    Fordert einen Passwort-Reset an.
    Sendet eine E-Mail mit Reset-Link falls die E-Mail existiert.
    Gibt immer eine Erfolgsmeldung zurück (Security: keine User-Enumeration).
    """
    user = await get_user_by_email(data.email)

    if user:
        # Token erstellen
        token = await create_reset_token(user["uid"])

        # Site-URL und Titel laden
        site_url = await get_site_url()
        site_title = await get_site_title()

        # Reset-Link erstellen
        reset_link = f"{site_url}/reset-password?token={token}"

        # E-Mail senden
        subject = f"Passwort zurücksetzen - {site_title}"
        html_content = EmailService._wrap_email_html(
            "🔑 Passwort zurücksetzen",
            f"""
            <p>Hallo <strong>{user['username']}</strong>,</p>
            <p>Du hast angefordert, dein Passwort zurückzusetzen.</p>
            <p>Klicke auf den folgenden Link, um ein neues Passwort zu setzen:</p>
            <a href="{reset_link}" class="button">Passwort zurücksetzen</a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
                Dieser Link ist {TOKEN_EXPIRY_HOURS} Stunde gültig.<br>
                Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.
            </p>
            """
        )
        text_content = f"""
Hallo {user['username']},

Du hast angefordert, dein Passwort zurückzusetzen.

Klicke auf den folgenden Link, um ein neues Passwort zu setzen:
{reset_link}

Dieser Link ist {TOKEN_EXPIRY_HOURS} Stunde gültig.
Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Dein {site_title} Team
        """.strip()

        await EmailService.send_email(
            to_email=data.email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )

    # Immer Erfolgsmeldung zurückgeben (verhindert User-Enumeration)
    return {"message": "If an account with this email exists, a reset link has been sent."}


@router.post("/reset")
async def reset_password(data: PasswordResetConfirm):
    """
    Setzt das Passwort mit einem gültigen Reset-Token zurück.
    """
    # Token prüfen
    user_uid = await verify_reset_token(data.token)

    if not user_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Passwort-Validierung
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

    # Neues Passwort hashen und speichern
    password_hash = get_password_hash(data.new_password)
    await update_user_password(user_uid, password_hash)

    # Token als benutzt markieren
    await mark_token_used(data.token)

    return {"message": "Password has been reset successfully"}


@router.get("/verify/{token}")
async def verify_token(token: str):
    """
    Prüft ob ein Reset-Token noch gültig ist.
    Für Frontend-Validierung bevor das Formular angezeigt wird.
    """
    user_uid = await verify_reset_token(token)

    if not user_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    return {"valid": True}
