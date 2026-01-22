from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.services.auth_service import get_current_user, verify_password, get_password_hash
from app.services.media_service import MediaService
from app.db.postgres import PostgresDB
from app.db.moderation import is_admin
from app.models.schemas import UserWithStats, UserRole


router = APIRouter(prefix="/users", tags=["Users"])


class UserUpdateRequest(BaseModel):
    email: EmailStr
    bio: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserSearchResult(BaseModel):
    uid: int
    username: str
    bio: Optional[str] = None
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserProfile(BaseModel):
    uid: int
    username: str
    bio: Optional[str] = None
    role: str
    created_at: str
    profile_picture: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


@router.put("/me")
async def update_user_profile(
    update_data: UserUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Aktualisiert das Profil des aktuellen Users"""

    async with PostgresDB.connection() as conn:
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
                "UPDATE users SET email = %s, bio = %s, first_name = %s, last_name = %s, password_hash = %s WHERE uid = %s",
                (update_data.email, update_data.bio, update_data.first_name, update_data.last_name, new_hash, current_user["uid"])
            )
        else:
            # Nur E-Mail, Bio und Namen aktualisieren
            await conn.execute(
                "UPDATE users SET email = %s, bio = %s, first_name = %s, last_name = %s WHERE uid = %s",
                (update_data.email, update_data.bio, update_data.first_name, update_data.last_name, current_user["uid"])
            )

        await conn.commit()

        return {"message": "Profil erfolgreich aktualisiert"}


@router.post("/me/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Lädt ein Profilbild hoch"""

    # Validate file type (nur Bilder erlaubt)
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nur Bilddateien sind erlaubt"
        )

    # Upload file using media service
    media_service = MediaService()

    try:
        upload_result = await media_service.upload_file(current_user["uid"], file)

        # Store profile picture path in database
        profile_picture_url = f"/api/media/{current_user['uid']}/{upload_result['path']}"

        async with PostgresDB.connection() as conn:
            # Delete old profile picture if exists
            if current_user.get("profile_picture"):
                old_path = current_user["profile_picture"].replace(f"/api/media/{current_user['uid']}/", "")
                try:
                    await media_service.delete_file(current_user["uid"], old_path)
                except:
                    pass  # Ignore if old file doesn't exist

            # Update profile picture in database
            await conn.execute(
                "UPDATE users SET profile_picture = %s WHERE uid = %s",
                (profile_picture_url, current_user["uid"])
            )
            await conn.commit()

        return {
            "message": "Profilbild erfolgreich hochgeladen",
            "profile_picture": profile_picture_url
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fehler beim Hochladen: {str(e)}"
        )


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

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT uid, username, bio, role, first_name, last_name
            FROM users
            WHERE username ILIKE %s
              AND uid != %s
              AND is_banned = FALSE
            LIMIT 20
            """,
            (f"%{q}%", current_user["uid"])
        )
        rows = await result.fetchall()

        return [
            UserSearchResult(
                uid=row["uid"],
                username=row["username"],
                bio=row["bio"],
                role=row["role"],
                first_name=row.get("first_name"),
                last_name=row.get("last_name")
            )
            for row in rows
        ]


@router.get("/{user_uid}", response_model=UserProfile)
async def get_user_profile(
    user_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """Lädt das Profil eines Benutzers"""

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT uid, username, bio, role, created_at, profile_picture, first_name, last_name
            FROM users
            WHERE uid = %s AND is_banned = FALSE
            """,
            (user_uid,)
        )
        row = await result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Benutzer nicht gefunden"
            )

        return UserProfile(
            uid=row["uid"],
            username=row["username"],
            bio=row["bio"],
            role=row["role"],
            created_at=row["created_at"].isoformat() if row["created_at"] else "",
            profile_picture=row["profile_picture"] if "profile_picture" in row.keys() else None,
            first_name=row.get("first_name"),
            last_name=row.get("last_name")
        )


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

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
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
        rows = await result.fetchall()

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

    async with PostgresDB.connection() as conn:
        if days:
            # Temporärer Bann
            await conn.execute(
                """
                UPDATE users
                SET is_banned = TRUE,
                    banned_until = NOW() + INTERVAL '%s days',
                    ban_reason = %s
                WHERE uid = %s
                """,
                (days, reason, user_uid)
            )
        else:
            # Permanenter Bann
            await conn.execute(
                """
                UPDATE users
                SET is_banned = TRUE,
                    banned_until = NULL,
                    ban_reason = %s
                WHERE uid = %s
                """,
                (reason, user_uid)
            )

        await conn.commit()

        return {"message": "User erfolgreich gebannt"}


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

    async with PostgresDB.connection() as conn:
        await conn.execute(
            """
            UPDATE users
            SET is_banned = FALSE,
                banned_until = NULL,
                ban_reason = NULL
            WHERE uid = %s
            """,
            (user_uid,)
        )

        await conn.commit()

        return {"message": "Bann erfolgreich aufgehoben"}
