from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from app.services.auth_service import get_current_user
from app.services.opensearch_service import OpenSearchService
from app.db.sqlite_posts import UserPostsDB


router = APIRouter(prefix="/public-feed", tags=["Public Feed"])


@router.get("")
async def get_public_feed(
    limit: int = 25,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Lädt die neuesten öffentlichen Posts.

    - **limit**: Anzahl Posts (default 25)
    - **offset**: Pagination offset

    Nur Posts mit visibility="public" werden zurückgegeben,
    sortiert nach created_at (neueste zuerst).
    """
    opensearch = OpenSearchService()
    result = await opensearch.get_public_posts(limit=limit, offset=offset)

    # Add is_liked_by_user field to each post
    current_user_uid = current_user["uid"]
    enriched_posts = []
    for post in result["posts"]:
        author_uid = post.get("author_uid")
        post_id = post.get("post_id")
        is_liked = False
        if author_uid and post_id:
            try:
                posts_db = UserPostsDB(author_uid)
                is_liked = await posts_db.is_liked_by_user(post_id, current_user_uid)
            except Exception:
                pass  # Ignore errors, default to False
        enriched_posts.append({
            **post,
            "is_liked_by_user": is_liked
        })

    return {
        "posts": enriched_posts,
        "total": result["total"],
        "has_more": result["has_more"]
    }
