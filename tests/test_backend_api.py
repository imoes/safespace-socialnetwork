"""
SafeSpace Social Network - Backend API Tests

Umfassende Tests für alle Backend API Endpoints mit detailliertem Logging.
Testet: Auth, Posts, Comments, Likes, Notifications, Guardian Modal, etc.

Author: SafeSpace Team
"""

import pytest
import requests
import json
import time
from datetime import datetime
from typing import Dict, Optional, Tuple
import logging
from pathlib import Path

# Logging Setup
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"backend_tests_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

# Create logger with file and console handlers
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# File handler
file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# Add handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)


class TestConfig:
    """Test Konfiguration"""
    BASE_URL = "http://localhost:8000"
    API_BASE = f"{BASE_URL}/api"

    # Test Users
    USER1 = {
        "username": f"testuser1_{int(time.time())}",
        "email": f"test1_{int(time.time())}@example.com",
        "password": "TestPass123!"
    }

    USER2 = {
        "username": f"testuser2_{int(time.time())}",
        "email": f"test2_{int(time.time())}@example.com",
        "password": "TestPass123!"
    }


class APIClient:
    """Helper-Klasse für API-Requests mit Logging"""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.token: Optional[str] = None

    def _log_request(self, method: str, url: str, **kwargs):
        """Loggt Request Details"""
        logger.info(f"➡️  {method} {url}")
        if 'json' in kwargs:
            logger.debug(f"   Body: {json.dumps(kwargs['json'], indent=2)}")
        if 'params' in kwargs:
            logger.debug(f"   Params: {kwargs['params']}")

    def _log_response(self, response: requests.Response, start_time: float):
        """Loggt Response Details"""
        duration = (time.time() - start_time) * 1000
        logger.info(f"⬅️  {response.status_code} ({duration:.0f}ms)")

        try:
            if response.text:
                data = response.json()
                logger.debug(f"   Response: {json.dumps(data, indent=2)}")
        except:
            logger.debug(f"   Response: {response.text[:200]}")

    def request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Macht einen API Request mit Logging"""
        url = f"{self.base_url}{endpoint}"

        # Add auth token if available
        if self.token:
            if 'headers' not in kwargs:
                kwargs['headers'] = {}
            kwargs['headers']['Authorization'] = f"Bearer {self.token}"

        self._log_request(method, url, **kwargs)
        start_time = time.time()

        response = self.session.request(method, url, **kwargs)

        self._log_response(response, start_time)
        return response

    def get(self, endpoint: str, **kwargs):
        return self.request('GET', endpoint, **kwargs)

    def post(self, endpoint: str, **kwargs):
        return self.request('POST', endpoint, **kwargs)

    def put(self, endpoint: str, **kwargs):
        return self.request('PUT', endpoint, **kwargs)

    def delete(self, endpoint: str, **kwargs):
        return self.request('DELETE', endpoint, **kwargs)


@pytest.fixture(scope="session")
def api_client():
    """Erstellt einen API Client"""
    logger.info("=" * 80)
    logger.info("🚀 Starting Backend API Tests")
    logger.info("=" * 80)

    client = APIClient(TestConfig.API_BASE)
    yield client

    logger.info("=" * 80)
    logger.info("✅ Backend API Tests Complete")
    logger.info(f"📝 Log file: {log_file}")
    logger.info("=" * 80)


@pytest.fixture(scope="session")
def user1_auth(api_client: APIClient) -> Tuple[Dict, str]:
    """Registriert und authentifiziert User 1"""
    logger.info("\n" + "=" * 80)
    logger.info("👤 Setting up User 1")
    logger.info("=" * 80)

    # Register
    response = api_client.post("/auth/register", json=TestConfig.USER1)
    assert response.status_code == 200, f"Registration failed: {response.text}"

    token_data = response.json()
    assert "access_token" in token_data, f"No access token in response: {token_data}"

    token = token_data["access_token"]
    api_client.token = token
    logger.info(f"✅ User 1 registered, token obtained")

    # Get user data via /me endpoint
    response = api_client.get("/auth/me")
    assert response.status_code == 200, f"Failed to get user data: {response.text}"

    user_data = response.json()
    logger.info(f"✅ User 1 data retrieved: {user_data['username']} (UID: {user_data['uid']})")

    return user_data, token


@pytest.fixture(scope="session")
def user2_auth(api_client: APIClient, user1_auth) -> Tuple[Dict, str]:
    """Registriert und authentifiziert User 2"""
    logger.info("\n" + "=" * 80)
    logger.info("👤 Setting up User 2")
    logger.info("=" * 80)

    # Temporarily save user1 token
    user1_token = api_client.token

    # Register
    response = api_client.post("/auth/register", json=TestConfig.USER2)
    assert response.status_code == 200, f"Registration failed: {response.text}"

    token_data = response.json()
    assert "access_token" in token_data, f"No access token in response: {token_data}"

    token = token_data["access_token"]
    api_client.token = token
    logger.info(f"✅ User 2 registered, token obtained")

    # Get user data via /me endpoint
    response = api_client.get("/auth/me")
    assert response.status_code == 200, f"Failed to get user data: {response.text}"

    user_data = response.json()
    logger.info(f"✅ User 2 data retrieved: {user_data['username']} (UID: {user_data['uid']})")

    # Restore user1 token
    api_client.token = user1_token

    return user_data, token


class TestAuthentication:
    """Tests für Authentifizierung"""

    def test_register_success(self, api_client: APIClient):
        """Test erfolgreiche Registrierung"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: User Registration")
        logger.info("-" * 80)

        user_data = {
            "username": f"newuser_{int(time.time())}",
            "email": f"new_{int(time.time())}@example.com",
            "password": "NewPass123!"
        }

        response = api_client.post("/auth/register", json=user_data)
        assert response.status_code == 200

        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"

        logger.info("✅ Registration successful, token received")

    def test_register_duplicate_username(self, api_client: APIClient, user1_auth):
        """Test Registrierung mit existierendem Username"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Duplicate Username Registration")
        logger.info("-" * 80)

        user_data = {
            "username": TestConfig.USER1["username"],
            "email": f"different_{int(time.time())}@example.com",
            "password": "TestPass123!"
        }

        response = api_client.post("/auth/register", json=user_data)
        assert response.status_code == 400

        logger.info("✅ Duplicate username correctly rejected")

    def test_login_success(self, api_client: APIClient, user1_auth):
        """Test erfolgreicher Login"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: User Login")
        logger.info("-" * 80)

        # Login requires form data, not JSON
        login_data = {
            "username": TestConfig.USER1["username"],
            "password": TestConfig.USER1["password"]
        }

        response = api_client.post("/auth/login", data=login_data)
        assert response.status_code == 200

        data = response.json()
        assert "access_token" in data
        assert "token_type" in data

        logger.info("✅ Login successful, token received")

    def test_login_wrong_password(self, api_client: APIClient, user1_auth):
        """Test Login mit falschem Passwort"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Login with Wrong Password")
        logger.info("-" * 80)

        # Login requires form data, not JSON
        login_data = {
            "username": TestConfig.USER1["username"],
            "password": "WrongPassword123!"
        }

        response = api_client.post("/auth/login", data=login_data)
        assert response.status_code == 401

        logger.info("✅ Wrong password correctly rejected")

    def test_get_current_user(self, api_client: APIClient, user1_auth):
        """Test /me endpoint"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Get Current User")
        logger.info("-" * 80)

        response = api_client.get("/auth/me")
        assert response.status_code == 200

        data = response.json()
        assert data["username"] == TestConfig.USER1["username"]

        logger.info("✅ Current user data retrieved")


class TestPosts:
    """Tests für Posts"""

    def test_create_post(self, api_client: APIClient, user1_auth):
        """Test Post erstellen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Create Post")
        logger.info("-" * 80)

        post_data = {
            "content": "Das ist ein Test-Post! 🚀",
            "visibility": "public"
        }

        response = api_client.post("/feed", json=post_data)
        assert response.status_code == 200

        data = response.json()
        assert "post_id" in data
        assert data["content"] == post_data["content"]
        assert data["visibility"] == post_data["visibility"]

        logger.info(f"✅ Post created: ID {data['post_id']}")
        return data

    def test_get_feed(self, api_client: APIClient, user1_auth):
        """Test Feed abrufen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Get Feed")
        logger.info("-" * 80)

        # Erst einen Post erstellen
        self.test_create_post(api_client, user1_auth)

        response = api_client.get("/feed")
        assert response.status_code == 200

        data = response.json()
        assert "posts" in data
        assert len(data["posts"]) > 0

        logger.info(f"✅ Feed retrieved: {len(data['posts'])} posts")

    def test_update_post(self, api_client: APIClient, user1_auth):
        """Test Post bearbeiten"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Update Post")
        logger.info("-" * 80)

        # Post erstellen
        post = self.test_create_post(api_client, user1_auth)

        # Post aktualisieren - Endpoint is /feed/{post_id}/content
        update_data = {
            "content": "Aktualisierter Test-Post! ✏️"
        }

        response = api_client.put(f"/feed/{post['post_id']}/content", json=update_data)
        assert response.status_code == 200

        data = response.json()
        assert data["content"] == update_data["content"]

        logger.info(f"✅ Post updated: ID {post['post_id']}")

    def test_delete_post(self, api_client: APIClient, user1_auth):
        """Test Post löschen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Delete Post")
        logger.info("-" * 80)

        # Post erstellen
        post = self.test_create_post(api_client, user1_auth)

        # Post löschen
        response = api_client.delete(f"/feed/{post['post_id']}")
        assert response.status_code == 200

        logger.info(f"✅ Post deleted: ID {post['post_id']}")


class TestComments:
    """Tests für Kommentare"""

    def test_add_comment(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Kommentar hinzufügen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Add Comment")
        logger.info("-" * 80)

        # User 1 erstellt Post
        post_data = {
            "content": "Post für Kommentar-Test",
            "visibility": "public"
        }
        response = api_client.post("/feed", json=post_data)
        post = response.json()

        # User 2 kommentiert
        user1_data, user1_token = user1_auth
        user2_data, user2_token = user2_auth

        api_client.token = user2_token

        response = api_client.post(
            f"/feed/{user1_data['uid']}/{post['post_id']}/comment",
            params={"content": "Toller Post! 👍"}
        )
        assert response.status_code == 200

        comment = response.json()
        assert "comment_id" in comment

        logger.info(f"✅ Comment added: ID {comment['comment_id']}")

        # Restore user1 token
        api_client.token = user1_token
        return post, comment

    def test_get_comments(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Kommentare abrufen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Get Comments")
        logger.info("-" * 80)

        post, comment = self.test_add_comment(api_client, user1_auth, user2_auth)
        user1_data, _ = user1_auth

        response = api_client.get(f"/feed/{user1_data['uid']}/{post['post_id']}/comments")
        assert response.status_code == 200

        data = response.json()
        assert "comments" in data
        assert len(data["comments"]) > 0

        logger.info(f"✅ Comments retrieved: {len(data['comments'])} comments")

    def test_comment_with_hate_speech(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Kommentar mit Hatespeech"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Comment with Hate Speech (Guardian Modal)")
        logger.info("-" * 80)

        # User 1 erstellt Post
        post_data = {
            "content": "Post für Hatespeech-Test",
            "visibility": "public"
        }
        response = api_client.post("/feed", json=post_data)
        post = response.json()

        # User 2 versucht Hatespeech-Kommentar
        user1_data, user1_token = user1_auth
        user2_data, user2_token = user2_auth

        api_client.token = user2_token

        hate_speech_content = "Diese scheiss ausländer sollen verschwinden!"
        response = api_client.post(
            f"/feed/{user1_data['uid']}/{post['post_id']}/comment",
            params={"content": hate_speech_content}
        )

        # Sollte 400 mit Guardian Modal Details zurückgeben
        assert response.status_code == 400

        data = response.json()
        assert "detail" in data
        detail = data["detail"]

        assert detail["error"] == "comment_contains_hate_speech"
        assert "explanation" in detail
        assert "suggested_revision" in detail or "alternative_suggestions" in detail

        logger.info("✅ Hate speech detected, Guardian Modal data provided")
        logger.info(f"   Explanation: {detail['explanation'][:100]}...")

        # Restore user1 token
        api_client.token = user1_token


class TestLikes:
    """Tests für Likes"""

    def test_like_post(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Post liken"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Like Post")
        logger.info("-" * 80)

        # User 1 erstellt Post
        post_data = {
            "content": "Post zum Liken",
            "visibility": "public"
        }
        response = api_client.post("/feed", json=post_data)
        post = response.json()

        # User 2 liked Post
        user1_data, user1_token = user1_auth
        user2_data, user2_token = user2_auth

        api_client.token = user2_token

        response = api_client.post(f"/feed/{user1_data['uid']}/{post['post_id']}/like")
        assert response.status_code == 200

        logger.info(f"✅ Post liked: ID {post['post_id']}")

        # Restore user1 token
        api_client.token = user1_token
        return post

    def test_unlike_post(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Post unliken"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Unlike Post")
        logger.info("-" * 80)

        post = self.test_like_post(api_client, user1_auth, user2_auth)

        user1_data, user1_token = user1_auth
        user2_data, user2_token = user2_auth

        api_client.token = user2_token

        response = api_client.delete(f"/feed/{user1_data['uid']}/{post['post_id']}/like")
        assert response.status_code == 200

        logger.info(f"✅ Post unliked: ID {post['post_id']}")

        # Restore user1 token
        api_client.token = user1_token


class TestNotifications:
    """Tests für Benachrichtigungen"""

    def test_get_notifications(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Benachrichtigungen abrufen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Get Notifications")
        logger.info("-" * 80)

        # User 2 liked User 1's Post (creates notification for User 1)
        post_data = {
            "content": "Post für Notification-Test",
            "visibility": "public"
        }
        response = api_client.post("/feed", json=post_data)
        post = response.json()

        user1_data, user1_token = user1_auth
        user2_data, user2_token = user2_auth

        api_client.token = user2_token
        api_client.post(f"/feed/{user1_data['uid']}/{post['post_id']}/like")

        # User 1 holt Notifications
        api_client.token = user1_token

        response = api_client.get("/notifications")
        assert response.status_code == 200

        data = response.json()
        assert "notifications" in data

        logger.info(f"✅ Notifications retrieved: {len(data['notifications'])} notifications")
        return data["notifications"]

    def test_get_unread_count(self, api_client: APIClient, user1_auth):
        """Test ungelesene Benachrichtigungen zählen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Get Unread Count")
        logger.info("-" * 80)

        response = api_client.get("/notifications/unread-count")
        assert response.status_code == 200

        data = response.json()
        assert "count" in data

        logger.info(f"✅ Unread count retrieved: {data['count']}")

    def test_mark_notification_as_read(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Benachrichtigung als gelesen markieren"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Mark Notification as Read")
        logger.info("-" * 80)

        notifications = self.test_get_notifications(api_client, user1_auth, user2_auth)

        if len(notifications) > 0:
            notification_id = notifications[0]["notification_id"]

            response = api_client.post(f"/notifications/{notification_id}/read")
            assert response.status_code == 200

            logger.info(f"✅ Notification marked as read: ID {notification_id}")
        else:
            logger.warning("⚠️  No notifications to mark as read")

    def test_delete_notification(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Benachrichtigung löschen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Delete Notification")
        logger.info("-" * 80)

        notifications = self.test_get_notifications(api_client, user1_auth, user2_auth)

        if len(notifications) > 0:
            notification_id = notifications[0]["notification_id"]

            response = api_client.delete(f"/notifications/{notification_id}")
            assert response.status_code == 200

            logger.info(f"✅ Notification deleted: ID {notification_id}")
        else:
            logger.warning("⚠️  No notifications to delete")


class TestUserSearch:
    """Tests für Benutzersuche"""

    def test_search_users(self, api_client: APIClient, user1_auth, user2_auth):
        """Test Benutzer suchen"""
        logger.info("\n" + "-" * 80)
        logger.info("TEST: Search Users")
        logger.info("-" * 80)

        user1_data, _ = user1_auth
        search_query = user1_data["username"][:5]  # First 5 chars

        # API expects parameter 'q' not 'query'
        response = api_client.get(f"/users/search", params={"q": search_query})
        assert response.status_code == 200

        # API returns a list directly, not {"users": [...]}
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        logger.info(f"✅ User search completed: {len(data)} users found for '{search_query}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
