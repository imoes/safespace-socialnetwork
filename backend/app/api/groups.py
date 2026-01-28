"""API-Routen für Gruppen"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.services.auth_service import get_current_user
from app.db.postgres import PostgresDB, get_username_map, get_user_profile_data_map
from app.db.sqlite_group_posts import GroupPostsDB
from app.db.notifications import create_notification

router = APIRouter(prefix="/groups", tags=["groups"])


# === Pydantic Models ===

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    join_mode: str = "open"  # open or approval


class GroupPostCreate(BaseModel):
    content: str
    visibility: str = "internal"  # internal or public


class RoleUpdate(BaseModel):
    role: str  # admin or member


class GroupSettings(BaseModel):
    join_mode: str  # open or approval


# === Helper Functions ===

async def _get_group_or_404(group_id: int) -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT * FROM groups WHERE group_id = %s", (group_id,)
        )
        group = await result.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        return group


async def _get_member_role(group_id: int, user_uid: int) -> str | None:
    """Returns role only for active members (not pending)."""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT role FROM group_members WHERE group_id = %s AND user_uid = %s AND status = 'active'",
            (group_id, user_uid)
        )
        row = await result.fetchone()
        return row["role"] if row else None


async def _get_member_status(group_id: int, user_uid: int) -> str | None:
    """Returns member status (active/pending) or None if not in group."""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT status FROM group_members WHERE group_id = %s AND user_uid = %s",
            (group_id, user_uid)
        )
        row = await result.fetchone()
        return row["status"] if row else None


async def _is_member(group_id: int, user_uid: int) -> bool:
    return await _get_member_role(group_id, user_uid) is not None


async def _is_admin(group_id: int, user_uid: int) -> bool:
    role = await _get_member_role(group_id, user_uid)
    return role in ("admin", "owner")


# === Routes ===

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(data: GroupCreate, current_user: dict = Depends(get_current_user)):
    """Erstellt eine neue Gruppe. Ersteller wird automatisch Owner."""
    uid = current_user["uid"]

    if data.join_mode not in ("open", "approval"):
        raise HTTPException(status_code=400, detail="join_mode must be 'open' or 'approval'")

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            INSERT INTO groups (name, description, created_by, join_mode)
            VALUES (%s, %s, %s, %s)
            RETURNING group_id, name, description, join_mode, created_by, created_at
            """,
            (data.name, data.description, uid, data.join_mode)
        )
        group = await result.fetchone()

        # Ersteller als Owner hinzufügen
        await conn.execute(
            """
            INSERT INTO group_members (group_id, user_uid, role, status)
            VALUES (%s, %s, 'owner', 'active')
            """,
            (group["group_id"], uid)
        )
        await conn.commit()

    return {
        "group": {
            **dict(group),
            "created_at": group["created_at"].isoformat() if group["created_at"] else None
        }
    }


@router.get("")
async def list_groups(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Listet Gruppen auf, optional mit Suche (case-insensitive)."""
    async with PostgresDB.connection() as conn:
        if search:
            result = await conn.execute(
                """
                SELECT g.*, COUNT(gm.id) as member_count
                FROM groups g
                LEFT JOIN group_members gm ON g.group_id = gm.group_id AND gm.status = 'active'
                WHERE LOWER(g.name) LIKE LOWER(%s)
                GROUP BY g.group_id
                ORDER BY g.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (f"%{search}%", limit, offset)
            )
        else:
            result = await conn.execute(
                """
                SELECT g.*, COUNT(gm.id) as member_count
                FROM groups g
                LEFT JOIN group_members gm ON g.group_id = gm.group_id AND gm.status = 'active'
                GROUP BY g.group_id
                ORDER BY g.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset)
            )
        groups = await result.fetchall()

    return {
        "groups": [
            {
                **dict(g),
                "created_at": g["created_at"].isoformat() if g["created_at"] else None
            }
            for g in groups
        ]
    }


@router.get("/my")
async def my_groups(current_user: dict = Depends(get_current_user)):
    """Listet alle Gruppen des aktuellen Users."""
    uid = current_user["uid"]

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT g.*, gm.role as my_role, gm.status as my_status, COUNT(gm2.id) as member_count
            FROM groups g
            INNER JOIN group_members gm ON g.group_id = gm.group_id AND gm.user_uid = %s
            LEFT JOIN group_members gm2 ON g.group_id = gm2.group_id AND gm2.status = 'active'
            GROUP BY g.group_id, gm.role, gm.status
            ORDER BY g.created_at DESC
            """,
            (uid,)
        )
        groups = await result.fetchall()

    return {
        "groups": [
            {
                **dict(g),
                "created_at": g["created_at"].isoformat() if g["created_at"] else None
            }
            for g in groups
        ]
    }


@router.get("/{group_id}")
async def get_group(group_id: int, current_user: dict = Depends(get_current_user)):
    """Gibt Gruppendetails zurück."""
    group = await _get_group_or_404(group_id)
    uid = current_user["uid"]

    # Mitgliederzahl (nur aktive)
    async with PostgresDB.connection() as conn:
        count_result = await conn.execute(
            "SELECT COUNT(*) as count FROM group_members WHERE group_id = %s AND status = 'active'",
            (group_id,)
        )
        count_row = await count_result.fetchone()

        # Pending requests count (für Admins)
        pending_result = await conn.execute(
            "SELECT COUNT(*) as count FROM group_members WHERE group_id = %s AND status = 'pending'",
            (group_id,)
        )
        pending_row = await pending_result.fetchone()

    my_role = await _get_member_role(group_id, uid)
    my_status = await _get_member_status(group_id, uid)

    return {
        "group": {
            **dict(group),
            "created_at": group["created_at"].isoformat() if group["created_at"] else None,
            "member_count": count_row["count"],
            "pending_count": pending_row["count"],
            "my_role": my_role,
            "my_status": my_status
        }
    }


@router.delete("/{group_id}")
async def delete_group(group_id: int, current_user: dict = Depends(get_current_user)):
    """Löscht eine Gruppe. Nur Owner/Admin."""
    group = await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only group admins can delete the group")

    async with PostgresDB.connection() as conn:
        await conn.execute("DELETE FROM group_posts WHERE group_id = %s", (group_id,))
        await conn.execute("DELETE FROM group_members WHERE group_id = %s", (group_id,))
        await conn.execute("DELETE FROM groups WHERE group_id = %s", (group_id,))
        await conn.commit()

    return {"message": "Group deleted"}


@router.post("/{group_id}/join")
async def join_group(group_id: int, current_user: dict = Depends(get_current_user)):
    """Tritt einer Gruppe bei. Bei approval-Modus wird eine Anfrage gestellt."""
    group = await _get_group_or_404(group_id)
    uid = current_user["uid"]

    # Check if already a member or has pending request
    existing_status = await _get_member_status(group_id, uid)
    if existing_status == "active":
        raise HTTPException(status_code=400, detail="Already a member")
    if existing_status == "pending":
        raise HTTPException(status_code=400, detail="Join request already pending")

    join_mode = group.get("join_mode", "open")
    member_status = "active" if join_mode == "open" else "pending"

    async with PostgresDB.connection() as conn:
        await conn.execute(
            """
            INSERT INTO group_members (group_id, user_uid, role, status)
            VALUES (%s, %s, 'member', %s)
            ON CONFLICT (group_id, user_uid) DO UPDATE SET status = %s
            """,
            (group_id, uid, member_status, member_status)
        )
        await conn.commit()

    if member_status == "pending":
        return {"message": "Join request sent", "status": "pending"}
    return {"message": "Joined group", "status": "active"}


@router.post("/{group_id}/leave")
async def leave_group(group_id: int, current_user: dict = Depends(get_current_user)):
    """Verlässt eine Gruppe. Owner kann nicht verlassen."""
    group = await _get_group_or_404(group_id)
    uid = current_user["uid"]

    role = await _get_member_role(group_id, uid)
    if not role:
        raise HTTPException(status_code=400, detail="Not a member")
    if role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot leave the group. Delete it instead.")

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "DELETE FROM group_members WHERE group_id = %s AND user_uid = %s",
            (group_id, uid)
        )
        await conn.commit()

    return {"message": "Left group"}


@router.get("/{group_id}/members")
async def get_members(group_id: int, current_user: dict = Depends(get_current_user)):
    """Listet aktive Gruppenmitglieder auf."""
    await _get_group_or_404(group_id)

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT gm.user_uid, gm.role, gm.joined_at,
                   u.username, u.profile_picture
            FROM group_members gm
            JOIN users u ON gm.user_uid = u.uid
            WHERE gm.group_id = %s AND gm.status = 'active'
            ORDER BY
                CASE gm.role
                    WHEN 'owner' THEN 0
                    WHEN 'admin' THEN 1
                    ELSE 2
                END,
                gm.joined_at ASC
            """,
            (group_id,)
        )
        members = await result.fetchall()

    return {
        "members": [
            {
                **dict(m),
                "joined_at": m["joined_at"].isoformat() if m["joined_at"] else None
            }
            for m in members
        ]
    }


@router.get("/{group_id}/pending")
async def get_pending_members(group_id: int, current_user: dict = Depends(get_current_user)):
    """Listet ausstehende Beitrittsanfragen auf. Nur Admins/Owner."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only admins can view pending requests")

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT gm.user_uid, gm.joined_at,
                   u.username, u.profile_picture
            FROM group_members gm
            JOIN users u ON gm.user_uid = u.uid
            WHERE gm.group_id = %s AND gm.status = 'pending'
            ORDER BY gm.joined_at ASC
            """,
            (group_id,)
        )
        pending = await result.fetchall()

    return {
        "pending": [
            {
                **dict(p),
                "joined_at": p["joined_at"].isoformat() if p["joined_at"] else None
            }
            for p in pending
        ]
    }


@router.post("/{group_id}/approve/{user_uid}")
async def approve_member(group_id: int, user_uid: int, current_user: dict = Depends(get_current_user)):
    """Genehmigt eine Beitrittsanfrage. Nur Admins/Owner."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only admins can approve requests")

    member_status = await _get_member_status(group_id, user_uid)
    if member_status != "pending":
        raise HTTPException(status_code=400, detail="No pending request from this user")

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE group_members SET status = 'active' WHERE group_id = %s AND user_uid = %s",
            (group_id, user_uid)
        )
        await conn.commit()

    return {"message": "Member approved"}


@router.post("/{group_id}/reject/{user_uid}")
async def reject_member(group_id: int, user_uid: int, current_user: dict = Depends(get_current_user)):
    """Lehnt eine Beitrittsanfrage ab. Nur Admins/Owner."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only admins can reject requests")

    member_status = await _get_member_status(group_id, user_uid)
    if member_status != "pending":
        raise HTTPException(status_code=400, detail="No pending request from this user")

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "DELETE FROM group_members WHERE group_id = %s AND user_uid = %s",
            (group_id, user_uid)
        )
        await conn.commit()

    return {"message": "Request rejected"}


@router.put("/{group_id}/settings")
async def update_group_settings(
    group_id: int,
    data: GroupSettings,
    current_user: dict = Depends(get_current_user)
):
    """Aktualisiert Gruppen-Einstellungen. Nur Admins/Owner."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only admins can change group settings")

    if data.join_mode not in ("open", "approval"):
        raise HTTPException(status_code=400, detail="join_mode must be 'open' or 'approval'")

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE groups SET join_mode = %s WHERE group_id = %s",
            (data.join_mode, group_id)
        )
        await conn.commit()

    return {"message": "Settings updated", "join_mode": data.join_mode}


@router.put("/{group_id}/members/{user_uid}/role")
async def update_member_role(
    group_id: int,
    user_uid: int,
    data: RoleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Ändert die Rolle eines Mitglieds. Nur Admins/Owner. Owner kann nicht geändert werden."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only admins can change roles")

    if data.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    # Owner-Rolle kann nicht geändert werden
    target_role = await _get_member_role(group_id, user_uid)
    if not target_role:
        raise HTTPException(status_code=404, detail="User is not a member")
    if target_role == "owner":
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE group_members SET role = %s WHERE group_id = %s AND user_uid = %s AND status = 'active'",
            (data.role, group_id, user_uid)
        )
        await conn.commit()

    return {"message": f"Role updated to {data.role}", "role": data.role}


@router.delete("/{group_id}/members/{user_uid}")
async def remove_member(
    group_id: int,
    user_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """Entfernt ein Mitglied aus der Gruppe. Nur Admins/Owner."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_admin(group_id, uid):
        raise HTTPException(status_code=403, detail="Only admins can remove members")

    target_role = await _get_member_role(group_id, user_uid)
    if not target_role:
        raise HTTPException(status_code=404, detail="User is not a member")
    if target_role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    async with PostgresDB.connection() as conn:
        await conn.execute(
            "DELETE FROM group_members WHERE group_id = %s AND user_uid = %s",
            (group_id, user_uid)
        )
        await conn.commit()

    return {"message": "Member removed"}


# === Group Posts ===

@router.post("/{group_id}/posts")
async def create_group_post(
    group_id: int,
    data: GroupPostCreate,
    current_user: dict = Depends(get_current_user)
):
    """Erstellt einen Post in der Gruppe. Nur Mitglieder."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    if not await _is_member(group_id, uid):
        raise HTTPException(status_code=403, detail="Only members can post in the group")

    if data.visibility not in ("internal", "public"):
        raise HTTPException(status_code=400, detail="Visibility must be 'internal' or 'public'")

    # Post in SQLite erstellen
    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()
    post = await group_db.create_post(
        author_uid=uid,
        content=data.content,
        visibility=data.visibility
    )

    # Metadaten in PostgreSQL speichern
    async with PostgresDB.connection() as conn:
        await conn.execute(
            """
            INSERT INTO group_posts (group_id, post_id, author_uid, visibility)
            VALUES (%s, %s, %s, %s)
            """,
            (group_id, post["post_id"], uid, data.visibility)
        )
        await conn.commit()

    # Benachrichtigungen an alle Gruppenmitglieder senden (außer Autor)
    async with PostgresDB.connection() as conn:
        members_result = await conn.execute(
            "SELECT user_uid FROM group_members WHERE group_id = %s AND user_uid != %s",
            (group_id, uid)
        )
        members = await members_result.fetchall()

    for member in members:
        try:
            await create_notification(
                user_uid=member["user_uid"],
                actor_uid=uid,
                notification_type="group_post",
                post_id=post["post_id"],
                post_author_uid=uid
            )
        except Exception as e:
            print(f"Error creating group notification: {e}")

    return {
        "post": {
            **post,
            "author_uid": uid,
            "author_username": current_user["username"],
            "group_id": group_id
        }
    }


@router.get("/{group_id}/posts")
async def get_group_posts(
    group_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Lädt Posts einer Gruppe. Interne Posts nur für Mitglieder."""
    await _get_group_or_404(group_id)
    uid = current_user["uid"]

    is_member = await _is_member(group_id, uid)

    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()

    if is_member:
        posts = await group_db.get_posts(limit=limit, offset=offset)
    else:
        posts = await group_db.get_posts(limit=limit, offset=offset, visibility=["public"])

    # Autoren-Info laden
    author_uids = list(set(p["author_uid"] for p in posts))
    profile_map = await get_user_profile_data_map(author_uids) if author_uids else {}

    enriched = []
    for post in posts:
        author_data = profile_map.get(post["author_uid"], {"username": "Unknown", "profile_picture": None})
        likes_count = await group_db.get_likes_count(post["post_id"])
        comments_count = await group_db.get_comments_count(post["post_id"])
        is_liked = await group_db.is_liked_by_user(post["post_id"], uid)

        enriched.append({
            **post,
            "author_username": author_data["username"],
            "author_profile_picture": author_data.get("profile_picture"),
            "group_id": group_id,
            "likes_count": likes_count,
            "comments_count": comments_count,
            "is_liked_by_user": is_liked
        })

    return {"posts": enriched, "is_member": is_member}


@router.post("/{group_id}/posts/{post_id}/like")
async def like_group_post(
    group_id: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Liked einen Gruppen-Post."""
    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()
    success = await group_db.add_like(post_id, current_user["uid"])
    if not success:
        raise HTTPException(status_code=400, detail="Already liked")
    likes_count = await group_db.get_likes_count(post_id)
    return {"liked": True, "likes_count": likes_count}


@router.delete("/{group_id}/posts/{post_id}/like")
async def unlike_group_post(
    group_id: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Entfernt Like von einem Gruppen-Post."""
    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()
    await group_db.remove_like(post_id, current_user["uid"])
    likes_count = await group_db.get_likes_count(post_id)
    return {"liked": False, "likes_count": likes_count}


@router.post("/{group_id}/posts/{post_id}/comment")
async def comment_group_post(
    group_id: int,
    post_id: int,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Kommentiert einen Gruppen-Post."""
    content = data.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content required")

    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()
    comment = await group_db.add_comment(post_id, current_user["uid"], content)

    return {
        "comment": {
            **comment,
            "username": current_user["username"]
        }
    }


@router.get("/{group_id}/posts/{post_id}/comments")
async def get_group_post_comments(
    group_id: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Lädt Kommentare eines Gruppen-Posts."""
    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()
    comments = await group_db.get_comments(post_id)

    # Usernamen laden
    user_uids = list(set(c["user_uid"] for c in comments))
    profile_map = await get_user_profile_data_map(user_uids) if user_uids else {}

    enriched = []
    for c in comments:
        user_data = profile_map.get(c["user_uid"], {"username": "Unknown", "profile_picture": None})
        enriched.append({
            **c,
            "username": user_data["username"],
            "profile_picture": user_data.get("profile_picture")
        })

    return {"comments": enriched}


@router.delete("/{group_id}/posts/{post_id}")
async def delete_group_post(
    group_id: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Löscht einen Gruppen-Post. Nur Autor oder Admin."""
    uid = current_user["uid"]

    group_db = GroupPostsDB(group_id)
    await group_db._ensure_db()
    post = await group_db.get_post(post_id)

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    is_author = post["author_uid"] == uid
    is_group_admin = await _is_admin(group_id, uid)

    if not is_author and not is_group_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")

    await group_db.delete_post(post_id, deleted_by="user" if is_author else "admin")

    # Metadaten aus PostgreSQL entfernen
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "DELETE FROM group_posts WHERE group_id = %s AND post_id = %s",
            (group_id, post_id)
        )
        await conn.commit()

    return {"message": "Post deleted"}
