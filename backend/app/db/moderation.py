"""
Datenbank-Funktionen für Moderation, Reports und Rollen
Angepasst an das existierende Schema in postgres.py
"""

from datetime import datetime, timedelta
from typing import Optional
from app.db.postgres import PostgresDB


# === User Role Management ===

async def get_user_role(uid: int) -> str:
    async with PostgresDB.connection() as conn:
        result = await conn.execute("SELECT role FROM users WHERE uid = %s", (uid,))
        row = await result.fetchone()
        return row["role"] if row else "user"


async def set_user_role(uid: int, role: str) -> bool:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "UPDATE users SET role = %s WHERE uid = %s RETURNING uid", (role, uid)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def is_moderator_or_admin(uid: int) -> bool:
    return await get_user_role(uid) in ("moderator", "admin")


async def is_admin(uid: int) -> bool:
    return await get_user_role(uid) == "admin"


async def get_all_moderators() -> list[dict]:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT uid, username, email, role, created_at FROM users 
               WHERE role IN ('moderator', 'admin') ORDER BY role DESC, username"""
        )
        return await result.fetchall()


# === User Suspension ===

async def suspend_user(uid: int, reason: str, duration_days: int = None, moderator_uid: int = None) -> bool:
    banned_until = datetime.utcnow() + timedelta(days=duration_days) if duration_days else None
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET is_banned = TRUE, banned_until = %s, ban_reason = %s WHERE uid = %s",
            (banned_until, reason, uid)
        )
        await conn.commit()
        if moderator_uid:
            await log_moderator_action(moderator_uid, "suspend_user", target_user_uid=uid, reason=reason)
        return True


async def unsuspend_user(uid: int) -> bool:
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET is_banned = FALSE, banned_until = NULL, ban_reason = NULL WHERE uid = %s", (uid,)
        )
        await conn.commit()
        return True


async def is_user_suspended(uid: int) -> tuple[bool, Optional[str]]:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT is_banned, banned_until, ban_reason FROM users WHERE uid = %s", (uid,)
        )
        row = await result.fetchone()
        if not row or not row["is_banned"]:
            return False, None
        if row["banned_until"] and row["banned_until"] < datetime.utcnow():
            await unsuspend_user(uid)
            return False, None
        return True, row["ban_reason"]


# === Post Reports (user_reports table) ===

async def create_report(post_id: int, post_author_uid: int, reporter_uid: int, 
                       reason: str, category: str = "other", description: str = None) -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """INSERT INTO user_reports (post_id, author_uid, reporter_uid, reason, description)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (post_id, post_author_uid, reporter_uid, reason, description)
        )
        await conn.commit()
        return await result.fetchone()


async def get_pending_reports(limit: int = 50, offset: int = 0) -> list[dict]:
    """Lädt Reports mit Post-Inhalt"""
    from app.db.sqlite_posts import UserPostsDB

    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT r.report_id, r.post_id, r.author_uid as post_author_uid, r.reporter_uid,
                      r.reason, r.description, r.status, r.created_at, r.reviewed_by,
                      u_reporter.username as reporter_username,
                      u_author.username as author_username
               FROM user_reports r
               LEFT JOIN users u_reporter ON r.reporter_uid = u_reporter.uid
               LEFT JOIN users u_author ON r.author_uid = u_author.uid
               WHERE r.status IN ('pending', 'reviewing')
               ORDER BY r.created_at DESC LIMIT %s OFFSET %s""",
            (limit, offset)
        )
        reports = await result.fetchall()

    # Lade Post-Daten für jeden Report
    enriched_reports = []
    for report in reports:
        report_dict = dict(report)

        # Lade Post aus SQLite
        try:
            posts_db = UserPostsDB(report["post_author_uid"])
            post = await posts_db.get_post(report["post_id"])
            if post:
                report_dict["post_content"] = post.get("content", "")
                report_dict["post_created_at"] = post.get("created_at", "")
                report_dict["post_visibility"] = post.get("visibility", "")
                report_dict["post_likes_count"] = post.get("likes_count", 0)
                report_dict["post_comments_count"] = post.get("comments_count", 0)
            else:
                report_dict["post_content"] = "[Post nicht gefunden]"
        except Exception as e:
            print(f"Error loading post for report {report['report_id']}: {e}")
            report_dict["post_content"] = "[Fehler beim Laden des Posts]"

        enriched_reports.append(report_dict)

    return enriched_reports


async def get_report(report_id: int) -> dict | None:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT r.report_id, r.post_id, r.author_uid as post_author_uid, r.reporter_uid,
                      r.reason, r.description, r.status, r.created_at, r.reviewed_by,
                      u_reporter.username as reporter_username, 
                      u_author.username as author_username
               FROM user_reports r
               LEFT JOIN users u_reporter ON r.reporter_uid = u_reporter.uid
               LEFT JOIN users u_author ON r.author_uid = u_author.uid
               WHERE r.report_id = %s""",
            (report_id,)
        )
        return await result.fetchone()


async def assign_report(report_id: int, moderator_uid: int) -> bool:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """UPDATE user_reports SET reviewed_by = %s, status = 'reviewing'
               WHERE report_id = %s AND status = 'pending' RETURNING report_id""",
            (moderator_uid, report_id)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def resolve_report(report_id: int, moderator_uid: int, resolution_note: str, dismissed: bool = False) -> bool:
    status = "dismissed" if dismissed else "resolved"
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """UPDATE user_reports SET status = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP,
               action_taken = %s WHERE report_id = %s RETURNING report_id""",
            (status, moderator_uid, resolution_note, report_id)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def get_user_report_count(uid: int) -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT COUNT(*) as total_reports,
                      COUNT(*) FILTER (WHERE status = 'resolved') as resolved_reports,
                      COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_reports,
                      COUNT(*) FILTER (WHERE status IN ('pending', 'reviewing')) as pending_reports
               FROM user_reports WHERE author_uid = %s""",
            (uid,)
        )
        return await result.fetchone()


# === Moderator Actions (moderation_log table) ===

async def log_moderator_action(moderator_uid: int, action_type: str, target_post_id: int = None,
                               target_user_uid: int = None, report_id: int = None,
                               safespace_report_path: str = None, reason: str = None, notes: str = None) -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """INSERT INTO moderation_log (moderator_uid, target_uid, post_id, action, reason)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (moderator_uid, target_user_uid, target_post_id, action_type, reason)
        )
        await conn.commit()
        return await result.fetchone()


async def get_moderator_actions(moderator_uid: int = None, limit: int = 100) -> list[dict]:
    async with PostgresDB.connection() as conn:
        if moderator_uid:
            result = await conn.execute(
                """SELECT ml.log_id as action_id, ml.moderator_uid, ml.target_uid as target_user_uid,
                          ml.post_id as target_post_id, ml.action as action_type, ml.reason, ml.created_at,
                          u.username as moderator_username 
                   FROM moderation_log ml
                   JOIN users u ON ml.moderator_uid = u.uid 
                   WHERE ml.moderator_uid = %s ORDER BY ml.created_at DESC LIMIT %s""",
                (moderator_uid, limit)
            )
        else:
            result = await conn.execute(
                """SELECT ml.log_id as action_id, ml.moderator_uid, ml.target_uid as target_user_uid,
                          ml.post_id as target_post_id, ml.action as action_type, ml.reason, ml.created_at,
                          u.username as moderator_username 
                   FROM moderation_log ml
                   JOIN users u ON ml.moderator_uid = u.uid 
                   ORDER BY ml.created_at DESC LIMIT %s""",
                (limit,)
            )
        return await result.fetchall()


# === Relationship Types (friendships.relation_type) ===

async def set_relationship_type(user_uid: int, friend_uid: int, relationship: str) -> bool:
    async with PostgresDB.connection() as conn:
        await conn.execute(
            """UPDATE friendships SET relation_type = %s
               WHERE (user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s)""",
            (relationship, user_uid, friend_uid, friend_uid, user_uid)
        )
        await conn.commit()
        return True


async def get_relationship_type(user_uid: int, friend_uid: int) -> str | None:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT relation_type FROM friendships 
               WHERE ((user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s))
               AND status = 'accepted'""",
            (user_uid, friend_uid, friend_uid, user_uid)
        )
        row = await result.fetchone()
        return row["relation_type"] if row else None


async def get_friends_by_relationship(uid: int, relationship: str = None) -> list[dict]:
    async with PostgresDB.connection() as conn:
        if relationship:
            result = await conn.execute(
                """SELECT u.uid, u.username, f.relation_type as relationship, f.created_at FROM users u
                   INNER JOIN (
                       SELECT friend_id as uid, relation_type, created_at FROM friendships 
                       WHERE user_id = %s AND status = 'accepted' AND relation_type = %s
                       UNION
                       SELECT user_id as uid, relation_type, created_at FROM friendships 
                       WHERE friend_id = %s AND status = 'accepted' AND relation_type = %s
                   ) f ON u.uid = f.uid ORDER BY u.username""",
                (uid, relationship, uid, relationship)
            )
        else:
            result = await conn.execute(
                """SELECT u.uid, u.username, f.relation_type as relationship, f.created_at FROM users u
                   INNER JOIN (
                       SELECT friend_id as uid, relation_type, created_at FROM friendships 
                       WHERE user_id = %s AND status = 'accepted'
                       UNION
                       SELECT user_id as uid, relation_type, created_at FROM friendships 
                       WHERE friend_id = %s AND status = 'accepted'
                   ) f ON u.uid = f.uid ORDER BY f.relation_type, u.username""",
                (uid, uid)
            )
        return await result.fetchall()


# === Dashboard Stats ===

async def get_moderation_dashboard_stats() -> dict:
    async with PostgresDB.connection() as conn:
        report_result = await conn.execute(
            """SELECT COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
                      COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing_reports,
                      COUNT(*) FILTER (WHERE status = 'resolved' AND reviewed_at > CURRENT_DATE) as resolved_today,
                      COUNT(*) as total_reports_week
               FROM user_reports WHERE created_at > CURRENT_DATE - INTERVAL '7 days'"""
        )
        report_stats = await report_result.fetchone()
        
        user_result = await conn.execute(
            """SELECT COUNT(*) as total_users,
                      COUNT(*) FILTER (WHERE is_banned = TRUE) as suspended_users,
                      COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as new_users_week
               FROM users"""
        )
        user_stats = await user_result.fetchone()
        
        mod_result = await conn.execute(
            """SELECT COUNT(*) as actions_today, COUNT(DISTINCT moderator_uid) as active_moderators
               FROM moderation_log WHERE created_at > CURRENT_DATE"""
        )
        mod_stats = await mod_result.fetchone()
        
        return {"reports": dict(report_stats) if report_stats else {}, 
                "users": dict(user_stats) if user_stats else {}, 
                "moderators": dict(mod_stats) if mod_stats else {}}
