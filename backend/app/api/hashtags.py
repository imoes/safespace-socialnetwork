from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from pydantic import BaseModel

from app.services.auth_service import get_current_user
from app.services.opensearch_service import get_opensearch_service


router = APIRouter(prefix="/hashtags", tags=["Hashtags"])


class HashtagStat(BaseModel):
    hashtag: str
    count: int


class HashtagPost(BaseModel):
    post_id: int
    author_uid: int
    author_username: str
    author_first_name: str | None
    author_last_name: str | None
    content: str
    hashtags: List[str]
    media_urls: List[str]
    created_at: str
    likes_count: int
    comments_count: int


@router.get("/trending", response_model=List[HashtagStat])
async def get_trending_hashtags(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get trending hashtags based on usage count.
    Returns top hashtags sorted by post count.
    """
    try:
        opensearch = get_opensearch_service()
        hashtags = await opensearch.get_trending_hashtags(limit=limit)
        return [HashtagStat(**ht) for ht in hashtags]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching trending hashtags: {str(e)}"
        )


@router.get("/search/{hashtag}", response_model=List[HashtagPost])
async def search_by_hashtag(
    hashtag: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Search for public posts by hashtag.
    Returns top 50 posts with the specified hashtag, sorted by created_at (newest first).
    """
    try:
        opensearch = get_opensearch_service()
        posts = await opensearch.search_by_hashtag(hashtag=hashtag, limit=limit)
        return [HashtagPost(**post) for post in posts]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching hashtag: {str(e)}"
        )
