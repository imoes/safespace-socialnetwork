from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict
from pydantic import BaseModel

from app.services.auth_service import get_current_user
from app.services.opensearch_service import get_opensearch_service
from app.db.postgres import get_friends_with_info


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


class HashtagSearchResponse(BaseModel):
    posts: List[HashtagPost]
    has_more: bool


@router.get("/search/{hashtag}", response_model=HashtagSearchResponse)
async def search_by_hashtag(
    hashtag: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Search for posts by hashtag with pagination and visibility filtering.
    Returns posts with the specified hashtag, filtered by friendship status.
    """
    try:
        current_user_uid = current_user["uid"]

        # Get friends and their relation types
        friends_data = await get_friends_with_info(current_user_uid)
        friend_relations: Dict[int, str] = {}
        for friend in friends_data:
            friend_uid = friend["uid"]
            relation = friend["relation_type"]
            if relation:
                friend_relations[friend_uid] = relation

        opensearch = get_opensearch_service()

        # Fetch more posts than needed for post-filtering
        fetch_limit = (limit + 1) * 3  # Fetch 3x to account for filtering

        # Get posts from OpenSearch with basic visibility filter
        # Allow public + friends + close_friends + family (we'll filter more precisely below)
        allowed_visibilities = ["public", "friends", "close_friends", "family"]

        all_posts = await opensearch.search_by_hashtag(
            hashtag=hashtag,
            current_user_uid=current_user_uid,
            allowed_visibilities=allowed_visibilities,
            limit=fetch_limit,
            offset=offset
        )

        # Post-filter based on actual friendships
        filtered_posts = []
        for post in all_posts:
            author_uid = post.get("author_uid")
            post_visibility = post.get("visibility")

            # Own posts: always allowed
            if author_uid == current_user_uid:
                filtered_posts.append(post)
                continue

            # Public posts: always allowed
            if post_visibility == "public":
                filtered_posts.append(post)
                continue

            # Check if author is a friend
            if author_uid in friend_relations:
                relation = friend_relations[author_uid]

                # Determine allowed visibilities based on relation type
                if relation == "family":
                    allowed = ["friends", "close_friends", "family"]
                elif relation == "close_friend":
                    allowed = ["friends", "close_friends"]
                elif relation == "friend":
                    allowed = ["friends"]
                else:  # acquaintance
                    allowed = ["friends"]

                if post_visibility in allowed:
                    filtered_posts.append(post)

        # Apply pagination to filtered results
        has_more = len(filtered_posts) > limit
        paginated_posts = filtered_posts[:limit]

        return HashtagSearchResponse(
            posts=[HashtagPost(**post) for post in paginated_posts],
            has_more=has_more
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching hashtag: {str(e)}"
        )
