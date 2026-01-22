from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.services.auth_service import get_current_user, verify_password, get_password_hash
from app.db.postgres import pool
from app.db.moderation import is_admin
from app.models.schemas import UserWithStats, UserRole


router = APIRouter(prefix="/users", tags=["Users"])


class UserUpdateRequest(BaseModel):
    email: EmailStr
    bio: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserSearchResult(BaseModel):
    uid: int
    username: str
    bio: Optional[str] = None
    role: str


@router.put("/me")
async def update_user_profile(
    update_data: UserUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Aktualisiert das Profil des aktuellen Users"""

    conn = await pool.connection()
    try:
        # Passwort ändern wenn angegeben
        if update_data.current_password and update_data.new_password:
            # Aktuelles Passwort überprüfen
            if not verify_password(update_data.current_password, current_user["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Aktuelles Passwort ist falsch"
                )

            # Neues Passwort hashen und speichern
            new_hash = get_password_hash(update_data.new_password)
            await conn.execute(
                "UPDATE users SET email = $1, bio = $2, password_hash = $3 WHERE uid = $4",
                update_data.email,
                update_data.bio,
                new_hash,
                current_user["uid"]
            )
        else:
            # Nur E-Mail und Bio aktualisieren
            await conn.execute(
                "UPDATE users SET email = $1, bio = $2 WHERE uid = $3",
                update_data.email,
                update_data.bio,
                current_user["uid"]
            )

        return {"message": "Profil erfolgreich aktualisiert"}

    finally:
        await conn.close()


@router.get("/search")
async def search_users(
    q: str,
    current_user: dict = Depends(get_current_user)
):
    """Sucht nach Benutzern (für Freundschaftsanfragen)"""

    if len(q) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suchbegriff muss mindestens 2 Zeichen lang sein"
        )

    conn = await pool.connection()
    try:
        rows = await conn.fetch(
            """
            SELECT uid, username, bio, role
            FROM users
            WHERE username ILIKE $1
              AND uid != $2
              AND is_banned = FALSE
            LIMIT 20
            """,
            f"%{q}%",
            current_user["uid"]
        )

        return [
            UserSearchResult(
                uid=row["uid"],
                username=row["username"],
                bio=row["bio"],
                role=row["role"]
            )
            for row in rows
        ]

    finally:
        await conn.close()


@router.get("/all", response_model=List[UserWithStats])
async def get_all_users(
    current_user: dict = Depends(get_current_user)
):
    """Listet alle User mit Statistiken (nur für Admins)"""

    if not await is_admin(current_user["uid"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Admins können alle User sehen"
        )

    conn = await pool.connection()
    try:
        rows = await conn.fetch(
            """
            SELECT
                u.uid,
                u.username,
                u.role,
                u.created_at,
                u.is_banned,
                u.banned_until,
                COUNT(DISTINCT p.post_id) as post_count,
                COUNT(DISTINCT r.report_id) as report_count
            FROM users u
            LEFT JOIN posts p ON p.author_uid = u.uid
            LEFT JOIN user_reports r ON r.reporter_uid = u.uid
            GROUP BY u.uid
            ORDER BY u.created_at DESC
            """
        )

        return [
            UserWithStats(
                uid=row["uid"],
                username=row["username"],
                role=row["role"],
                created_at=row["created_at"],
                post_count=row["post_count"] or 0,
                report_count=row["report_count"] or 0,
                is_banned=row["is_banned"],
                banned_until=row["banned_until"]
            )
            for row in rows
        ]

    finally:
        await conn.close()


@router.post("/{user_uid}/ban")
async def ban_user(
    user_uid: int,
    reason: str,
    days: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Bannt einen User (nur für Admins)"""

    if not await is_admin(current_user["uid"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Admins können User bannen"
        )

    conn = await pool.connection()
    try:
        if days:
            # Temporärer Bann
            await conn.execute(
                """
                UPDATE users
                SET is_banned = TRUE,
                    banned_until = NOW() + INTERVAL '%s days',
                    ban_reason = $2
                WHERE uid = $3
                """,
                days,
                reason,
                user_uid
            )
        else:
            # Permanenter Bann
            await conn.execute(
                """
                UPDATE users
                SET is_banned = TRUE,
                    banned_until = NULL,
                    ban_reason = $1
                WHERE uid = $2
                """,
                reason,
                user_uid
            )

        return {"message": "User erfolgreich gebannt"}

    finally:
        await conn.close()


@router.post("/{user_uid}/unban")
async def unban_user(
    user_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """Entfernt den Bann eines Users (nur für Admins)"""

    if not await is_admin(current_user["uid"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Admins können User entbannen"
        )

    conn = await pool.connection()
    try:
        await conn.execute(
            """
            UPDATE users
            SET is_banned = FALSE,
                banned_until = NULL,
                ban_reason = NULL
            WHERE uid = $1
            """,
            user_uid
        )

        return {"message": "Bann erfolgreich aufgehoben"}

    finally:
        await conn.close()
