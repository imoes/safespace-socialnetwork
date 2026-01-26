from opensearchpy import OpenSearch, helpers
from typing import List, Dict, Any, Optional
import re
from datetime import datetime

from app.config import settings


class OpenSearchService:
    """
    OpenSearch Service for indexing and searching public posts.
    Handles hashtag extraction and aggregation.
    """

    def __init__(self):
        self.client = OpenSearch(
            hosts=[{
                'host': settings.opensearch_host,
                'port': settings.opensearch_port
            }],
            use_ssl=settings.opensearch_use_ssl,
            verify_certs=settings.opensearch_verify_certs
        )
        self.index_name = settings.opensearch_index_posts

    async def ensure_index(self):
        """Creates the posts index if it doesn't exist"""
        if not self.client.indices.exists(index=self.index_name):
            index_body = {
                "mappings": {
                    "properties": {
                        "post_id": {"type": "integer"},
                        "author_uid": {"type": "integer"},
                        "author_username": {"type": "keyword"},
                        "author_first_name": {"type": "text"},
                        "author_last_name": {"type": "text"},
                        "content": {"type": "text"},
                        "hashtags": {"type": "keyword"},  # For exact matching and aggregations
                        "media_urls": {"type": "keyword"},
                        "visibility": {"type": "keyword"},  # For filtering by visibility
                        "created_at": {"type": "date"},
                        "likes_count": {"type": "integer"},
                        "comments_count": {"type": "integer"}
                    }
                },
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0
                }
            }
            self.client.indices.create(index=self.index_name, body=index_body)

    def extract_hashtags(self, content: str) -> List[str]:
        """
        Extracts hashtags from post content.
        Pattern: #letters (only letters, no numbers)
        """
        hashtag_pattern = r'#([a-zA-ZäöüÄÖÜß]+)'
        hashtags = re.findall(hashtag_pattern, content)
        # Convert to lowercase for consistency
        return [tag.lower() for tag in hashtags]

    async def index_post(
        self,
        doc_id: str,
        post_id: int,
        author_uid: int,
        author_username: str,
        author_first_name: Optional[str],
        author_last_name: Optional[str],
        content: str,
        media_urls: List[str],
        visibility: str,
        created_at: datetime,
        likes_count: int = 0,
        comments_count: int = 0
    ) -> str:
        """
        Indexes a post in OpenSearch with visibility filtering.
        Returns the document ID.
        """
        await self.ensure_index()

        # Extract hashtags from content
        hashtags = self.extract_hashtags(content)

        doc_body = {
            "post_id": post_id,
            "author_uid": author_uid,
            "author_username": author_username,
            "author_first_name": author_first_name or "",
            "author_last_name": author_last_name or "",
            "content": content,
            "hashtags": hashtags,
            "media_urls": media_urls,
            "visibility": visibility,
            "created_at": created_at.isoformat(),
            "likes_count": likes_count,
            "comments_count": comments_count
        }

        response = self.client.index(
            index=self.index_name,
            id=doc_id,
            body=doc_body,
            refresh=True  # Make immediately searchable
        )

        return response['_id']

    async def delete_post(self, doc_id: str) -> bool:
        """
        Deletes a post from the OpenSearch index.
        Returns True if successful, False if document not found.
        """
        try:
            self.client.delete(
                index=self.index_name,
                id=doc_id,
                refresh=True
            )
            return True
        except Exception:
            return False

    async def delete_all_user_posts(self, author_uid: int) -> int:
        """
        Löscht alle Posts eines Users aus OpenSearch.
        Returns: Anzahl der gelöschten Dokumente.
        """
        try:
            await self.ensure_index()

            # Suche alle Posts des Users
            response = self.client.delete_by_query(
                index=self.index_name,
                body={
                    "query": {
                        "term": {
                            "author_uid": author_uid
                        }
                    }
                },
                refresh=True
            )

            return response.get("deleted", 0)
        except Exception as e:
            print(f"Fehler beim Löschen von User-Posts aus OpenSearch: {e}")
            return 0

    async def update_post_counts(
        self,
        doc_id: str,
        likes_count: Optional[int] = None,
        comments_count: Optional[int] = None
    ) -> bool:
        """
        Updates likes and comments counts for a post.
        """
        try:
            update_body = {"doc": {}}
            if likes_count is not None:
                update_body["doc"]["likes_count"] = likes_count
            if comments_count is not None:
                update_body["doc"]["comments_count"] = comments_count

            self.client.update(
                index=self.index_name,
                id=doc_id,
                body=update_body,
                refresh=True
            )
            return True
        except Exception:
            return False

    async def search_by_hashtag(
        self,
        hashtag: str,
        current_user_uid: int,
        allowed_visibilities: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Searches for posts by hashtag with pagination and visibility filtering.

        Args:
            hashtag: The hashtag to search for
            current_user_uid: UID of the user performing the search
            allowed_visibilities: List of visibility levels the user can see (e.g., ["public", "friends"])
                                  None means all visibilities (for own posts)
            limit: Number of results to return
            offset: Offset for pagination

        Returns posts sorted by created_at (newest first).
        """
        await self.ensure_index()

        # Remove # prefix if present
        hashtag = hashtag.lstrip('#').lower()

        # Build query with hashtag filter
        must_clauses = [
            {"term": {"hashtags": hashtag}}
        ]

        # Build visibility filter
        should_clauses = [
            # Always include own posts
            {"term": {"author_uid": current_user_uid}}
        ]

        # Add allowed visibilities for other users' posts
        if allowed_visibilities:
            for visibility in allowed_visibilities:
                should_clauses.append({
                    "bool": {
                        "must": [
                            {"term": {"visibility": visibility}},
                            {"bool": {"must_not": {"term": {"author_uid": current_user_uid}}}}
                        ]
                    }
                })

        query = {
            "query": {
                "bool": {
                    "must": must_clauses,
                    "should": should_clauses,
                    "minimum_should_match": 1
                }
            },
            "sort": [
                {"created_at": {"order": "desc"}}
            ],
            "size": limit,
            "from": offset
        }

        response = self.client.search(
            index=self.index_name,
            body=query
        )

        return [hit['_source'] for hit in response['hits']['hits']]

    async def get_trending_hashtags(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Gets trending hashtags based on usage count in the last 24 hours.
        Returns list of hashtags with their counts.
        """
        await self.ensure_index()

        # Calculate timestamp for 24 hours ago
        from datetime import datetime, timedelta
        twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)

        query = {
            "size": 0,
            "query": {
                "range": {
                    "created_at": {
                        "gte": twenty_four_hours_ago.isoformat()
                    }
                }
            },
            "aggs": {
                "hashtags": {
                    "terms": {
                        "field": "hashtags",
                        "size": limit,
                        "order": {"_count": "desc"}
                    }
                }
            }
        }

        response = self.client.search(
            index=self.index_name,
            body=query
        )

        buckets = response['aggregations']['hashtags']['buckets']
        return [
            {
                "hashtag": bucket['key'],
                "count": bucket['doc_count']
            }
            for bucket in buckets
        ]

    async def autocomplete_hashtags(self, prefix: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Autocomplete hashtags based on prefix search.
        Returns hashtags that start with the given prefix, sorted by usage count.
        """
        await self.ensure_index()

        # Use prefix query with aggregation
        query = {
            "size": 0,
            "query": {
                "prefix": {
                    "hashtags": {
                        "value": prefix.lower()
                    }
                }
            },
            "aggs": {
                "hashtags": {
                    "terms": {
                        "field": "hashtags",
                        "size": limit * 2,  # Get more to filter
                        "order": {"_count": "desc"}
                    }
                }
            }
        }

        response = self.client.search(
            index=self.index_name,
            body=query
        )

        buckets = response['aggregations']['hashtags']['buckets']

        # Filter to only include hashtags that start with prefix
        results = []
        for bucket in buckets:
            if bucket['key'].startswith(prefix.lower()):
                results.append({
                    "hashtag": bucket['key'],
                    "count": bucket['doc_count']
                })
                if len(results) >= limit:
                    break

        return results

    async def search_posts(
        self,
        query_string: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        General search for posts by content.
        """
        await self.ensure_index()

        if query_string:
            query = {
                "query": {
                    "multi_match": {
                        "query": query_string,
                        "fields": ["content", "author_username", "author_first_name", "author_last_name"]
                    }
                },
                "sort": [
                    {"created_at": {"order": "desc"}}
                ],
                "size": limit
            }
        else:
            query = {
                "query": {"match_all": {}},
                "sort": [
                    {"created_at": {"order": "desc"}}
                ],
                "size": limit
            }

        response = self.client.search(
            index=self.index_name,
            body=query
        )

        return [hit['_source'] for hit in response['hits']['hits']]

    async def get_public_posts(
        self,
        limit: int = 25,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Gets the latest public posts with pagination.
        Returns posts sorted by created_at (newest first).
        """
        await self.ensure_index()

        query = {
            "query": {
                "term": {
                    "visibility": "public"
                }
            },
            "sort": [
                {"created_at": {"order": "desc"}}
            ],
            "size": limit,
            "from": offset
        }

        response = self.client.search(
            index=self.index_name,
            body=query
        )

        total = response['hits']['total']['value']
        posts = [hit['_source'] for hit in response['hits']['hits']]

        return {
            "posts": posts,
            "total": total,
            "has_more": offset + limit < total
        }


# Singleton instance
_opensearch_service = None


def get_opensearch_service() -> OpenSearchService:
    """Returns the singleton OpenSearch service instance"""
    global _opensearch_service
    if _opensearch_service is None:
        _opensearch_service = OpenSearchService()
    return _opensearch_service
