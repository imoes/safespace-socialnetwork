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
        Pattern: #word (alphanumeric and underscores)
        """
        hashtag_pattern = r'#(\w+)'
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
        created_at: datetime,
        likes_count: int = 0,
        comments_count: int = 0
    ) -> str:
        """
        Indexes a public post in OpenSearch.
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

    async def search_by_hashtag(self, hashtag: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Searches for posts by hashtag.
        Returns top 50 posts sorted by created_at (newest first).
        """
        await self.ensure_index()

        # Remove # prefix if present
        hashtag = hashtag.lstrip('#').lower()

        query = {
            "query": {
                "term": {
                    "hashtags": hashtag
                }
            },
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

    async def get_trending_hashtags(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Gets trending hashtags based on usage count.
        Returns list of hashtags with their counts.
        """
        await self.ensure_index()

        query = {
            "size": 0,
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


# Singleton instance
_opensearch_service = None


def get_opensearch_service() -> OpenSearchService:
    """Returns the singleton OpenSearch service instance"""
    global _opensearch_service
    if _opensearch_service is None:
        _opensearch_service = OpenSearchService()
    return _opensearch_service
