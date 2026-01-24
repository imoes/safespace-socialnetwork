from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from app.services.auth_service import get_current_user
from app.services.opensearch_service import OpenSearchService


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

    return {
        "posts": result["posts"],
        "total": result["total"],
        "has_more": result["has_more"]
    }
