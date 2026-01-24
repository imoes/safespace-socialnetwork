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


class PersonalPostRequest(BaseModel):
    content: str
    visibility: str = "public"  # Persönliche Posts sind standardmäßig öffentlich


class UserSearchResult(BaseModel):
    uid: int
    username: str
    bio: Optional[str] = None
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture: Optional[str] = None
    is_friend: bool = False


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
            SELECT
                u.uid,
                u.username,
                u.bio,
                u.role,
                u.first_name,
                u.last_name,
                u.profile_picture,
                CASE
                    WHEN f.id IS NOT NULL THEN TRUE
                    ELSE FALSE
                END as is_friend
            FROM users u
            LEFT JOIN friendships f ON (
                (f.user_id = %s AND f.friend_id = u.uid) OR
                (f.friend_id = %s AND f.user_id = u.uid)
            ) AND f.status = 'accepted'
            WHERE (u.username ILIKE %s
              OR u.first_name ILIKE %s
              OR u.last_name ILIKE %s
              OR CONCAT(u.first_name, ' ', u.last_name) ILIKE %s)
              AND u.uid != %s
              AND u.is_banned = FALSE
            ORDER BY is_friend DESC, u.username ASC
            LIMIT 20
            """,
            (current_user["uid"], current_user["uid"], f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", current_user["uid"])
        )
        rows = await result.fetchall()

        return [
            UserSearchResult(
                uid=row["uid"],
                username=row["username"],
                bio=row["bio"],
                role=row["role"],
                first_name=row.get("first_name"),
                last_name=row.get("last_name"),
                profile_picture=row.get("profile_picture"),
                is_friend=row["is_friend"]
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


@router.get("/me/posts")
async def get_my_posts(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Lädt alle Posts des aktuellen Benutzers"""
    from app.db.sqlite_posts import UserPostsDB
    from app.db.postgres import get_user_profile_data_map

    user_uid = current_user["uid"]

    # Posts laden (alle Sichtbarkeiten, da eigene Posts)
    posts_db = UserPostsDB(user_uid)
    raw_posts = await posts_db.get_posts(
        visibility=None,  # Alle Posts
        limit=limit,
        offset=offset
    )

    # Alle relevanten UIDs sammeln (Author + mögliche Recipients)
    all_uids = {user_uid}
    for post in raw_posts:
        if post.get("recipient_uid"):
            all_uids.add(post["recipient_uid"])

    # User-Profildata laden
    profile_data_map = await get_user_profile_data_map(list(all_uids))
    profile_data = profile_data_map.get(user_uid, {"username": current_user["username"], "profile_picture": current_user.get("profile_picture")})

    # Posts anreichern
    enriched_posts = []
    for post in raw_posts:
        likes_count = await posts_db.get_likes_count(post["post_id"])
        comments_count = await posts_db.get_comments_count(post["post_id"])

        # Media URLs bauen
        media_urls = []
        if post.get("media_paths"):
            media_urls = [f"/api/media/{user_uid}/{path}" for path in post["media_paths"]]

        # Recipient-Daten laden wenn persönlicher Post
        recipient_uid = post.get("recipient_uid")
        recipient_username = None
        if recipient_uid:
            recipient_data = profile_data_map.get(recipient_uid, {"username": "Unknown"})
            recipient_username = recipient_data["username"]

        enriched_posts.append({
            "post_id": post["post_id"],
            "author_uid": user_uid,
            "author_username": profile_data["username"],
            "author_profile_picture": profile_data["profile_picture"],
            "content": post["content"],
            "media_urls": media_urls,
            "visibility": post["visibility"],
            "created_at": post["created_at"],
            "likes_count": likes_count,
            "comments_count": comments_count,
            "is_own_post": True,
            "recipient_uid": recipient_uid,
            "recipient_username": recipient_username
        })

    return {
        "posts": enriched_posts,
        "has_more": len(raw_posts) == limit
    }


@router.get("/{user_uid}/posts")
async def get_user_posts(
    user_uid: int,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Lädt Posts eines Benutzers (unter Berücksichtigung von Sichtbarkeit und Freundschaft)"""
    from app.db.sqlite_posts import UserPostsDB
    from app.db.postgres import get_relation_type, get_user_profile_data_map

    # Prüfen ob es eigene Posts sind
    is_own_profile = current_user["uid"] == user_uid

    # Wenn eigene Posts: alle sichtbar
    # Wenn anderer User: nur Posts sehen die für mich sichtbar sind basierend auf Freundschaft
    if is_own_profile:
        allowed_visibility = None  # Alle Posts
    else:
        # Freundschaftsstatus prüfen
        relation_type = await get_relation_type(current_user["uid"], user_uid)

        if not relation_type:
            # Keine Freundschaft: nur öffentliche Posts
            allowed_visibility = ["public"]
        elif relation_type == "family":
            # Familie sieht: public, friends, close_friends, family
            allowed_visibility = ["public", "friends", "close_friends", "family"]
        elif relation_type == "close_friend":
            # Enge Freunde sehen: public, friends, close_friends
            allowed_visibility = ["public", "friends", "close_friends"]
        elif relation_type == "friend":
            # Normale Freunde sehen: public, friends
            allowed_visibility = ["public", "friends"]
        elif relation_type == "acquaintance":
            # Bekannte sehen: public, friends
            allowed_visibility = ["public", "friends"]
        else:
            # Default: nur öffentliche Posts
            allowed_visibility = ["public"]

    # Posts laden
    posts_db = UserPostsDB(user_uid)
    raw_posts = await posts_db.get_posts(
        visibility=allowed_visibility,
        limit=limit,
        offset=offset
    )

    # Alle relevanten UIDs sammeln (sowohl Profilbesitzer als auch potenzielle Autoren)
    all_uids = {user_uid}
    for post in raw_posts:
        if post.get("author_uid"):
            all_uids.add(post["author_uid"])

    # User-Profildata laden für alle UIDs
    profile_data_map = await get_user_profile_data_map(list(all_uids))
    profile_owner_data = profile_data_map.get(user_uid, {"username": "Unknown", "profile_picture": None})

    # Posts anreichern
    enriched_posts = []
    for post in raw_posts:
        likes_count = await posts_db.get_likes_count(post["post_id"])
        comments_count = await posts_db.get_comments_count(post["post_id"])

        # Media URLs bauen
        media_urls = []
        if post.get("media_paths"):
            media_urls = [f"/api/media/{user_uid}/{path}" for path in post["media_paths"]]

        # Bei persönlichen Posts: author_uid ist gesetzt
        if post.get("author_uid"):
            author_data = profile_data_map.get(post["author_uid"], {"username": "Unknown", "profile_picture": None})
            post_author_uid = post["author_uid"]
            post_author_username = author_data["username"]
            post_author_profile_picture = author_data["profile_picture"]
            recipient_uid = post.get("recipient_uid")
            recipient_username = profile_owner_data["username"]
        else:
            # Normaler Post vom Profilbesitzer
            post_author_uid = user_uid
            post_author_username = profile_owner_data["username"]
            post_author_profile_picture = profile_owner_data["profile_picture"]
            recipient_uid = None
            recipient_username = None

        enriched_posts.append({
            "post_id": post["post_id"],
            "author_uid": post_author_uid,
            "author_username": post_author_username,
            "author_profile_picture": post_author_profile_picture,
            "content": post["content"],
            "media_urls": media_urls,
            "visibility": post["visibility"],
            "created_at": post["created_at"],
            "likes_count": likes_count,
            "comments_count": comments_count,
            "is_own_post": is_own_profile and not post.get("author_uid"),  # Nur eigene normale Posts
            "recipient_uid": recipient_uid,
            "recipient_username": recipient_username
        })

    return {
        "posts": enriched_posts,
        "has_more": len(raw_posts) == limit
    }


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


@router.post("/{user_uid}/posts")
async def create_personal_post(
    user_uid: int,
    post_data: PersonalPostRequest,
    current_user: dict = Depends(get_current_user)
):
    """Erstellt einen persönlichen Post auf dem Profil eines anderen Users"""
    from app.db.sqlite_posts import UserPostsDB
    from app.db.postgres import get_user_by_uid

    # Prüfen ob Ziel-User existiert
    target_user = await get_user_by_uid(user_uid)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User nicht gefunden"
        )

    # Prüfen dass man nicht auf eigenes Profil schreibt
    if user_uid == current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Persönliche Posts können nicht auf dem eigenen Profil erstellt werden"
        )

    # Post in BEIDEN DBs speichern (Autor UND Empfänger)
    # 1. In der DB des Autors (für "Meine Posts")
    author_posts_db = UserPostsDB(current_user["uid"])
    author_post = await author_posts_db.create_post(
        content=post_data.content,
        visibility=post_data.visibility,
        recipient_uid=user_uid,  # Der Empfänger
        author_uid=current_user["uid"]  # Der Autor
    )

    # 2. In der DB des Empfängers (für deren Profil)
    recipient_posts_db = UserPostsDB(user_uid)
    await recipient_posts_db.create_post(
        content=post_data.content,
        visibility=post_data.visibility,
        recipient_uid=user_uid,  # Der Empfänger
        author_uid=current_user["uid"]  # Der Autor
    )

    return {
        "message": "Persönlicher Post erstellt",
        "post_id": author_post["post_id"],
        "recipient_uid": user_uid,
        "author_uid": current_user["uid"]
    }
