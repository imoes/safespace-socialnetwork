from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date

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
    preferred_language: Optional[str] = None
    birthday: Optional[date] = None


class LanguageUpdateRequest(BaseModel):
    preferred_language: str


class NotificationPreferencesRequest(BaseModel):
    post_liked: bool = True
    post_commented: bool = True
    comment_liked: bool = True
    birthday: bool = True
    group_post: bool = True


class ScreenTimeSettingsRequest(BaseModel):
    enabled: bool = True
    daily_limit_minutes: int = 120
    reminder_enabled: bool = True
    reminder_interval_minutes: int = 30


class ScreenTimeUsageRequest(BaseModel):
    date: str
    minutes: float


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
    birthday: Optional[date] = None
    is_friend: bool = False


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
                "UPDATE users SET email = %s, bio = %s, first_name = %s, last_name = %s, password_hash = %s, preferred_language = %s, birthday = %s WHERE uid = %s",
                (update_data.email, update_data.bio, update_data.first_name, update_data.last_name, new_hash, update_data.preferred_language, update_data.birthday, current_user["uid"])
            )
        else:
            # Nur E-Mail, Bio, Namen, Sprache und Geburtstag aktualisieren
            await conn.execute(
                "UPDATE users SET email = %s, bio = %s, first_name = %s, last_name = %s, preferred_language = %s, birthday = %s WHERE uid = %s",
                (update_data.email, update_data.bio, update_data.first_name, update_data.last_name, update_data.preferred_language, update_data.birthday, current_user["uid"])
            )

        await conn.commit()

        return {"message": "Profil erfolgreich aktualisiert"}


@router.patch("/me/language")
async def update_user_language(
    lang_data: LanguageUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Updates only the preferred language for the current user"""
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET preferred_language = %s WHERE uid = %s",
            (lang_data.preferred_language, current_user["uid"])
        )
        await conn.commit()

    return {"message": "Language updated", "preferred_language": lang_data.preferred_language}


@router.get("/me/notification-preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Gibt die E-Mail-Benachrichtigungseinstellungen zurück"""
    import json

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT notification_preferences FROM users WHERE uid = %s",
            (current_user["uid"],)
        )
        row = await result.fetchone()

    prefs = row["notification_preferences"] if row and row.get("notification_preferences") else {}

    # Default: alle aktiviert
    defaults = {
        "post_liked": True,
        "post_commented": True,
        "comment_liked": True,
        "birthday": True,
        "group_post": True
    }

    # Merge defaults mit gespeicherten Preferences
    merged = {**defaults, **prefs}
    return {"preferences": merged}


@router.put("/me/notification-preferences")
async def update_notification_preferences(
    prefs: NotificationPreferencesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Aktualisiert die E-Mail-Benachrichtigungseinstellungen"""
    import json

    prefs_dict = prefs.model_dump()

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET notification_preferences = %s WHERE uid = %s",
            (json.dumps(prefs_dict), current_user["uid"])
        )
        await conn.commit()

    return {"preferences": prefs_dict}


@router.get("/me/screen-time-settings")
async def get_screen_time_settings(current_user: dict = Depends(get_current_user)):
    """Gibt die Screen-Time-Einstellungen zurück"""
    import json

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT screen_time_settings FROM users WHERE uid = %s",
            (current_user["uid"],)
        )
        row = await result.fetchone()

    settings = row["screen_time_settings"] if row and row.get("screen_time_settings") else {}

    defaults = {
        "enabled": True,
        "daily_limit_minutes": 120,
        "reminder_enabled": True,
        "reminder_interval_minutes": 30
    }

    merged = {**defaults, **settings}
    return {"settings": merged}


@router.put("/me/screen-time-settings")
async def update_screen_time_settings(
    settings_data: ScreenTimeSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Aktualisiert die Screen-Time-Einstellungen"""
    import json

    settings_dict = settings_data.model_dump()

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET screen_time_settings = %s WHERE uid = %s",
            (json.dumps(settings_dict), current_user["uid"])
        )
        await conn.commit()

    return {"settings": settings_dict}


@router.post("/me/screen-time-usage")
async def save_screen_time_usage(
    usage_data: ScreenTimeUsageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Speichert die tägliche Nutzungszeit (wird beim Logout aufgerufen)"""
    import json

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT screen_time_settings FROM users WHERE uid = %s",
            (current_user["uid"],)
        )
        row = await result.fetchone()

    current_settings = row["screen_time_settings"] if row and row.get("screen_time_settings") else {}

    usage_log = current_settings.get("usage_log", {})
    usage_log[usage_data.date] = round(usage_data.minutes, 1)

    # Nur die letzten 30 Tage behalten
    sorted_dates = sorted(usage_log.keys(), reverse=True)[:30]
    usage_log = {d: usage_log[d] for d in sorted_dates}

    current_settings["usage_log"] = usage_log

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET screen_time_settings = %s WHERE uid = %s",
            (json.dumps(current_settings), current_user["uid"])
        )
        await conn.commit()

    return {"saved": True}


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
              OR CONCAT(u.first_name, ' ', u.last_name) ILIKE %s
              OR u.email ILIKE %s)
              AND u.uid != %s
              AND u.is_banned = FALSE
            ORDER BY is_friend DESC, u.username ASC
            LIMIT 20
            """,
            (current_user["uid"], current_user["uid"], f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", current_user["uid"])
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


@router.get("/list")
async def get_users_list(
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
                u.email,
                COALESCE(u.role, 'user') as role,
                COALESCE(u.created_at, CURRENT_TIMESTAMP) as created_at,
                COALESCE(u.is_banned, false) as is_banned,
                u.banned_until,
                COALESCE(u.posts_count, 0) as post_count,
                COALESCE(COUNT(DISTINCT CASE WHEN r.author_uid = u.uid THEN r.report_id END), 0) as flagged_count,
                COALESCE(COUNT(DISTINCT CASE WHEN r.reporter_uid = u.uid THEN r.report_id END), 0) as report_count
            FROM users u
            LEFT JOIN user_reports r ON (r.author_uid = u.uid OR r.reporter_uid = u.uid)
            GROUP BY u.uid, u.username, u.email, u.role, u.created_at, u.is_banned, u.banned_until, u.posts_count
            ORDER BY u.created_at DESC
            """
        )
        rows = await result.fetchall()

        users_list = []
        for row in rows:
            created_at = row["created_at"]
            if hasattr(created_at, 'isoformat'):
                created_at = created_at.isoformat()

            banned_until = row["banned_until"]
            if banned_until and hasattr(banned_until, 'isoformat'):
                banned_until = banned_until.isoformat()

            users_list.append({
                "uid": row["uid"],
                "username": row["username"],
                "email": row["email"],
                "role": row["role"],
                "created_at": created_at,
                "post_count": row["post_count"] or 0,
                "flagged_count": row["flagged_count"] or 0,
                "report_count": row["report_count"] or 0,
                "is_banned": row["is_banned"],
                "banned_until": banned_until
            })

        return users_list


@router.get("/{user_uid}", response_model=UserProfile)
async def get_user_profile(
    user_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """Lädt das Profil eines Benutzers"""
    from app.db.postgres import get_relation_type

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT uid, username, bio, role, created_at, profile_picture, first_name, last_name, birthday
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

        # Freundschaftsstatus prüfen
        is_friend = False
        if current_user["uid"] != user_uid:
            relation = await get_relation_type(current_user["uid"], user_uid)
            is_friend = relation is not None
        else:
            is_friend = True  # Eigenes Profil

        return UserProfile(
            uid=row["uid"],
            username=row["username"],
            bio=row["bio"],
            role=row["role"],
            created_at=row["created_at"].isoformat() if row["created_at"] else "",
            profile_picture=row["profile_picture"] if "profile_picture" in row.keys() else None,
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            birthday=row.get("birthday"),
            is_friend=is_friend
        )


@router.get("/me/commented-posts")
async def get_my_commented_posts(
    limit: int = 25,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Lädt alle Posts, auf denen der User kommentiert hat"""
    from app.db.sqlite_posts import UserPostsDB
    from app.db.postgres import get_user_profile_data_map

    user_uid = current_user["uid"]

    # Get all friends to check their posts
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT DISTINCT
                CASE
                    WHEN f.user_id = %s THEN f.friend_id
                    ELSE f.user_id
                END as friend_uid
            FROM friendships f
            WHERE (f.user_id = %s OR f.friend_id = %s)
              AND f.status = 'accepted'
            """,
            (user_uid, user_uid, user_uid)
        )
        friend_rows = await result.fetchall()
        friend_uids = [row["friend_uid"] for row in friend_rows]

    # Collect posts where user has commented
    all_commented_posts = []
    all_uids = {user_uid}

    # Check each friend's posts
    for friend_uid in friend_uids:
        try:
            posts_db = UserPostsDB(friend_uid)
            friend_posts = await posts_db.get_posts(visibility=None, limit=100)

            for post in friend_posts:
                # Check if current user has commented on this post
                comments = await posts_db.get_comments(post["post_id"])
                has_commented = any(comment["user_uid"] == user_uid for comment in comments)

                if has_commented:
                    all_uids.add(friend_uid)
                    if post.get("recipient_uid"):
                        all_uids.add(post["recipient_uid"])
                    if post.get("author_uid"):
                        all_uids.add(post["author_uid"])

                    likes_count = await posts_db.get_likes_count(post["post_id"])
                    comments_count = await posts_db.get_comments_count(post["post_id"])
                    is_liked = await posts_db.is_liked_by_user(post["post_id"], user_uid)

                    media_urls = []
                    if post.get("media_paths"):
                        media_urls = [f"/api/media/{friend_uid}/{path}" for path in post["media_paths"]]

                    all_commented_posts.append({
                        "post_id": post["post_id"],
                        "author_uid": post.get("author_uid") or friend_uid,
                        "content": post["content"],
                        "media_urls": media_urls,
                        "visibility": post["visibility"],
                        "created_at": post["created_at"],
                        "likes_count": likes_count,
                        "comments_count": comments_count,
                        "is_liked_by_user": is_liked,
                        "recipient_uid": post.get("recipient_uid"),
                        "_friend_uid": friend_uid  # Temporary field for enrichment
                    })
        except Exception as e:
            print(f"Error checking posts for friend {friend_uid}: {e}")
            continue

    # Sort by created_at descending
    all_commented_posts.sort(key=lambda x: x["created_at"], reverse=True)

    # Apply pagination
    paginated_posts = all_commented_posts[offset:offset+limit]

    # Load user profile data
    profile_data_map = await get_user_profile_data_map(list(all_uids))

    # Enrich posts with usernames and profile pictures
    enriched_posts = []
    for post in paginated_posts:
        author_uid = post["author_uid"]
        friend_uid = post.pop("_friend_uid")  # Remove temporary field
        author_data = profile_data_map.get(author_uid, {"username": "Unknown", "profile_picture": None})

        recipient_username = None
        if post.get("recipient_uid"):
            recipient_data = profile_data_map.get(post["recipient_uid"], {"username": "Unknown"})
            recipient_username = recipient_data["username"]

        enriched_posts.append({
            **post,
            "author_username": author_data["username"],
            "author_profile_picture": author_data["profile_picture"],
            "recipient_username": recipient_username,
            "is_own_post": author_uid == user_uid
        })

    return {
        "posts": enriched_posts,
        "has_more": len(all_commented_posts) > offset + limit
    }


@router.get("/me/posts")
async def get_my_posts(
    limit: int = 25,
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
        is_liked = await posts_db.is_liked_by_user(post["post_id"], user_uid)

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
            "is_liked_by_user": is_liked,
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
        is_liked = await posts_db.is_liked_by_user(post["post_id"], current_user["uid"])

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
            "is_liked_by_user": is_liked,
            "is_own_post": is_own_profile and not post.get("author_uid"),  # Nur eigene normale Posts
            "recipient_uid": recipient_uid,
            "recipient_username": recipient_username
        })

    return {
        "posts": enriched_posts,
        "has_more": len(raw_posts) == limit
    }


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


@router.delete("/{user_uid}")
async def delete_user_by_admin(
    user_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Löscht einen User vollständig (nur für Admins).
    - Löscht alle Posts aus SQLite
    - Löscht alle Medien
    - Löscht Public Posts aus OpenSearch
    - Löscht User aus PostgreSQL
    """
    if not await is_admin(current_user["uid"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Admins können User löschen"
        )

    # Prüfen dass Admin sich nicht selbst löscht
    if user_uid == current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sie können sich nicht selbst löschen"
        )

    import shutil
    from pathlib import Path
    from app.config import settings
    from app.services.opensearch_service import OpenSearchService

    # 1. Löschen aus OpenSearch (public posts)
    try:
        opensearch = OpenSearchService()
        await opensearch.delete_all_user_posts(user_uid)
    except Exception as e:
        print(f"Fehler beim Löschen von OpenSearch: {e}")

    # 2. Löschen der SQLite Datenbank und aller Medien
    user_data_dir = settings.user_data_base / str(user_uid)
    if user_data_dir.exists():
        try:
            shutil.rmtree(user_data_dir)
        except Exception as e:
            print(f"Fehler beim Löschen des User-Verzeichnisses: {e}")

    # 3. Löschen aus PostgreSQL (Freundschaften, Anfragen, Reports, etc.)
    async with PostgresDB.connection() as conn:
        # Freundschaften löschen
        await conn.execute(
            "DELETE FROM friendships WHERE user_id = %s OR friend_id = %s",
            (user_uid, user_uid)
        )

        # Reports löschen
        await conn.execute(
            "DELETE FROM user_reports WHERE reporter_uid = %s OR author_uid = %s",
            (user_uid, user_uid)
        )

        # Moderation Disputes löschen
        try:
            await conn.execute(
                "DELETE FROM moderation_disputes WHERE user_uid = %s",
                (user_uid,)
            )
        except:
            pass

        # Notifications löschen
        try:
            await conn.execute(
                "DELETE FROM notifications WHERE user_uid = %s",
                (user_uid,)
            )
        except:
            pass

        # User löschen
        await conn.execute(
            "DELETE FROM users WHERE uid = %s",
            (user_uid,)
        )

        await conn.commit()

    return {"message": f"User {user_uid} wurde vollständig gelöscht"}


@router.get("/me/data-export")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """
    DSGVO Art. 20 - Datenübertragbarkeit.
    Exportiert alle Benutzerdaten in maschinenlesbarem JSON-Format.
    """
    import json
    from app.db.sqlite_posts import UserPostsDB
    from app.config import settings

    user_uid = current_user["uid"]

    # 1. Profildaten aus PostgreSQL
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT uid, username, email, role, bio, created_at,
                      first_name, last_name, preferred_language, birthday,
                      notification_preferences, screen_time_settings, posts_count
               FROM users WHERE uid = %s""",
            (user_uid,)
        )
        user_row = await result.fetchone()

        # 2. Freundschaften
        result = await conn.execute(
            """SELECT f.friend_id, u.username, f.relation_type, f.status, f.created_at
               FROM friendships f
               JOIN users u ON u.uid = f.friend_id
               WHERE f.user_id = %s AND f.status = 'accepted'
               UNION
               SELECT f.user_id, u.username, f.relation_type, f.status, f.created_at
               FROM friendships f
               JOIN users u ON u.uid = f.user_id
               WHERE f.friend_id = %s AND f.status = 'accepted'""",
            (user_uid, user_uid)
        )
        friendships = await result.fetchall()

        # 3. Gruppen-Mitgliedschaften
        result = await conn.execute(
            """SELECT g.group_id, g.name, gm.role, gm.joined_at
               FROM group_members gm
               JOIN groups g ON g.group_id = gm.group_id
               WHERE gm.user_uid = %s AND gm.status = 'active'""",
            (user_uid,)
        )
        groups = await result.fetchall()

        # 4. Benachrichtigungs-Einstellungen
        notif_prefs = user_row["notification_preferences"] if user_row and user_row.get("notification_preferences") else {}
        screen_time = user_row["screen_time_settings"] if user_row and user_row.get("screen_time_settings") else {}

    # 5. Posts aus SQLite
    posts_data = []
    posts_db = UserPostsDB(user_uid)
    if posts_db.db_path.exists():
        posts = await posts_db.get_posts(include_deleted=False, limit=10000)
        for post in posts:
            posts_data.append({
                "post_id": post.get("post_id"),
                "content": post.get("content"),
                "visibility": post.get("visibility"),
                "created_at": post.get("created_at"),
                "media_paths": json.loads(post["media_paths"]) if post.get("media_paths") else [],
            })

    # Export zusammenstellen
    export_data = {
        "export_info": {
            "format": "DSGVO Art. 20 - Datenübertragbarkeit",
            "exported_at": str(date.today()),
            "user_uid": user_uid
        },
        "profile": {
            "username": user_row["username"] if user_row else None,
            "email": user_row["email"] if user_row else None,
            "first_name": user_row["first_name"] if user_row else None,
            "last_name": user_row["last_name"] if user_row else None,
            "bio": user_row["bio"] if user_row else None,
            "birthday": str(user_row["birthday"]) if user_row and user_row.get("birthday") else None,
            "preferred_language": user_row["preferred_language"] if user_row else None,
            "member_since": str(user_row["created_at"]) if user_row else None,
            "posts_count": user_row["posts_count"] if user_row else 0,
        },
        "settings": {
            "notification_preferences": notif_prefs,
            "screen_time_settings": screen_time,
        },
        "friendships": [
            {
                "friend_username": f["username"],
                "relation_type": f["relation_type"],
                "since": str(f["created_at"]),
            }
            for f in friendships
        ],
        "groups": [
            {
                "group_name": g["name"],
                "role": g["role"],
                "joined_at": str(g["joined_at"]),
            }
            for g in groups
        ],
        "posts": posts_data,
    }

    return export_data


@router.delete("/me/account")
async def delete_account(
    current_user: dict = Depends(get_current_user)
):
    """
    Löscht das Benutzerkonto vollständig.
    - Löscht alle Posts aus SQLite
    - Löscht alle Medien
    - Löscht Public Posts aus OpenSearch
    - Löscht User aus PostgreSQL
    """
    import shutil
    from pathlib import Path
    from app.config import settings
    from app.services.opensearch_service import OpenSearchService

    user_uid = current_user["uid"]

    # 1. Löschen aus OpenSearch (public posts)
    try:
        opensearch = OpenSearchService()
        await opensearch.delete_all_user_posts(user_uid)
    except Exception as e:
        print(f"Fehler beim Löschen von OpenSearch: {e}")

    # 2. Löschen der SQLite Datenbank und aller Medien
    user_data_dir = settings.user_data_base / str(user_uid)
    if user_data_dir.exists():
        try:
            shutil.rmtree(user_data_dir)
        except Exception as e:
            print(f"Fehler beim Löschen des User-Verzeichnisses: {e}")

    # 3. Löschen aus PostgreSQL (Freundschaften, Anfragen, Reports, etc.)
    async with PostgresDB.connection() as conn:
        # Freundschaften löschen
        await conn.execute(
            "DELETE FROM friendships WHERE user_id = %s OR friend_id = %s",
            (user_uid, user_uid)
        )

        # Reports löschen
        await conn.execute(
            "DELETE FROM user_reports WHERE reporter_uid = %s OR author_uid = %s",
            (user_uid, user_uid)
        )

        # Moderation Disputes löschen
        try:
            await conn.execute(
                "DELETE FROM moderation_disputes WHERE user_uid = %s",
                (user_uid,)
            )
        except:
            pass

        # Moderation Log anonymisieren (DSGVO: Audit-Trail bleibt, aber ohne Personenbezug)
        try:
            await conn.execute(
                "UPDATE moderation_log SET moderator_uid = NULL WHERE moderator_uid = %s",
                (user_uid,)
            )
            await conn.execute(
                "UPDATE moderation_log SET target_uid = NULL WHERE target_uid = %s",
                (user_uid,)
            )
        except:
            pass

        # Notifications löschen
        try:
            await conn.execute(
                "DELETE FROM notifications WHERE user_uid = %s OR actor_uid = %s",
                (user_uid, user_uid)
            )
        except:
            pass

        # User löschen
        await conn.execute(
            "DELETE FROM users WHERE uid = %s",
            (user_uid,)
        )

        await conn.commit()

    return {"message": "Account erfolgreich gelöscht"}


@router.post("/{user_uid}/posts")
async def create_personal_post(
    user_uid: int,
    post_data: PersonalPostRequest,
    current_user: dict = Depends(get_current_user)
):
    """Erstellt einen persönlichen Post auf dem Profil eines anderen Users"""
    from app.db.sqlite_posts import UserPostsDB
    from app.db.postgres import get_user_by_uid, increment_user_posts_count, get_relation_type

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

    # Prüfen ob man mit dem User befreundet ist
    relation = await get_relation_type(current_user["uid"], user_uid)
    if not relation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Du kannst nur auf Profilen von Freunden posten"
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

    # Post-Anzahl des Autors in PostgreSQL erhöhen
    await increment_user_posts_count(current_user["uid"])

    return {
        "message": "Persönlicher Post erstellt",
        "post_id": author_post["post_id"],
        "recipient_uid": user_uid,
        "author_uid": current_user["uid"]
    }
