"""
SafeSpace Social Network - Playwright E2E Tests

End-to-End Tests für die komplette Anwendung mit Browser-Automatisierung.
Testet die gesamte User Journey wie ein echter Benutzer.

Author: SafeSpace Team
"""

import pytest
import time
from datetime import datetime
from pathlib import Path
import logging
from playwright.sync_api import Page, expect, Browser, BrowserContext

# Logging Setup
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"e2e_tests_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class TestConfig:
    """Test Konfiguration"""
    BASE_URL = "http://localhost:4200"
    BACKEND_URL = "http://localhost:8000"

    # Test Users
    USER1_USERNAME = f"e2euser1_{int(time.time())}"
    USER1_EMAIL = f"e2etest1_{int(time.time())}@example.com"
    USER1_PASSWORD = "TestPass123!"

    USER2_USERNAME = f"e2euser2_{int(time.time())}"
    USER2_EMAIL = f"e2etest2_{int(time.time())}@example.com"
    USER2_PASSWORD = "TestPass123!"

    # Timeouts
    DEFAULT_TIMEOUT = 10000  # 10 seconds
    SLOW_TIMEOUT = 30000     # 30 seconds


class E2ELogger:
    """Helper für strukturiertes E2E Logging"""

    @staticmethod
    def test_start(test_name: str):
        logger.info("\n" + "=" * 80)
        logger.info(f"🧪 TEST: {test_name}")
        logger.info("=" * 80)

    @staticmethod
    def step(step_name: str):
        logger.info(f"   ▶️  {step_name}")

    @staticmethod
    def success(message: str):
        logger.info(f"   ✅ {message}")

    @staticmethod
    def warning(message: str):
        logger.warning(f"   ⚠️  {message}")

    @staticmethod
    def error(message: str):
        logger.error(f"   ❌ {message}")

    @staticmethod
    def screenshot(page: Page, name: str):
        """Macht Screenshot und loggt es"""
        screenshot_dir = Path(__file__).parent / "screenshots"
        screenshot_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        path = screenshot_dir / f"{name}_{timestamp}.png"
        page.screenshot(path=str(path))
        logger.info(f"   📸 Screenshot: {path}")


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Browser Kontext Konfiguration"""
    return {
        **browser_context_args,
        "viewport": {"width": 1920, "height": 1080},
        "locale": "de-DE",
    }


@pytest.fixture(scope="session", autouse=True)
def test_session_setup():
    """Setup vor allen Tests"""
    logger.info("=" * 80)
    logger.info("🚀 Starting Playwright E2E Tests")
    logger.info("=" * 80)
    logger.info(f"Frontend URL: {TestConfig.BASE_URL}")
    logger.info(f"Backend URL: {TestConfig.BACKEND_URL}")
    logger.info("=" * 80)

    yield

    logger.info("=" * 80)
    logger.info("✅ Playwright E2E Tests Complete")
    logger.info(f"📝 Log file: {log_file}")
    logger.info("=" * 80)


@pytest.fixture
def user1_page(page: Page) -> Page:
    """Registriert und logged User 1 ein"""
    E2ELogger.test_start("User 1 Setup (Registration & Login)")

    E2ELogger.step("Navigate to app")
    page.goto(TestConfig.BASE_URL)
    page.wait_for_load_state("networkidle")
    E2ELogger.success("Page loaded")

    # Check if we need to register
    E2ELogger.step("Checking if registration is needed")
    if page.locator("text=Registrieren").is_visible():
        E2ELogger.step("Clicking Register link")
        page.click("text=Registrieren")
        page.wait_for_url("**/register")

        E2ELogger.step(f"Filling registration form for {TestConfig.USER1_USERNAME}")
        page.fill("input[name='username']", TestConfig.USER1_USERNAME)
        page.fill("input[name='email']", TestConfig.USER1_EMAIL)
        page.fill("input[name='password']", TestConfig.USER1_PASSWORD)
        page.fill("input[name='confirmPassword']", TestConfig.USER1_PASSWORD)

        E2ELogger.screenshot(page, "user1_registration_form")

        E2ELogger.step("Submitting registration")
        page.click("button[type='submit']")

        # Wait for redirect to feed
        page.wait_for_url("**/feed", timeout=TestConfig.DEFAULT_TIMEOUT)
        E2ELogger.success("Registration successful, redirected to feed")
    else:
        E2ELogger.step("Already logged in or on login page")
        # Try to login
        if page.locator("input[name='username']").is_visible():
            E2ELogger.step(f"Logging in as {TestConfig.USER1_USERNAME}")
            page.fill("input[name='username']", TestConfig.USER1_USERNAME)
            page.fill("input[name='password']", TestConfig.USER1_PASSWORD)
            page.click("button[type='submit']")
            page.wait_for_url("**/feed", timeout=TestConfig.DEFAULT_TIMEOUT)
            E2ELogger.success("Login successful")

    E2ELogger.screenshot(page, "user1_logged_in")
    return page


@pytest.fixture
def user2_context(browser: Browser) -> BrowserContext:
    """Erstellt einen separaten Browser Context für User 2"""
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        locale="de-DE"
    )
    yield context
    context.close()


@pytest.fixture
def user2_page(user2_context: BrowserContext) -> Page:
    """Registriert und logged User 2 ein"""
    page = user2_context.new_page()

    E2ELogger.test_start("User 2 Setup (Registration & Login)")

    E2ELogger.step("Navigate to app")
    page.goto(TestConfig.BASE_URL)
    page.wait_for_load_state("networkidle")

    E2ELogger.step("Clicking Register link")
    if page.locator("text=Registrieren").is_visible():
        page.click("text=Registrieren")
        page.wait_for_url("**/register")

        E2ELogger.step(f"Filling registration form for {TestConfig.USER2_USERNAME}")
        page.fill("input[name='username']", TestConfig.USER2_USERNAME)
        page.fill("input[name='email']", TestConfig.USER2_EMAIL)
        page.fill("input[name='password']", TestConfig.USER2_PASSWORD)
        page.fill("input[name='confirmPassword']", TestConfig.USER2_PASSWORD)

        E2ELogger.screenshot(page, "user2_registration_form")

        E2ELogger.step("Submitting registration")
        page.click("button[type='submit']")

        page.wait_for_url("**/feed", timeout=TestConfig.DEFAULT_TIMEOUT)
        E2ELogger.success("Registration successful")

    E2ELogger.screenshot(page, "user2_logged_in")
    return page


class TestAuthentication:
    """E2E Tests für Authentifizierung"""

    def test_user_registration_flow(self, page: Page):
        """Test kompletter Registrierungs-Flow"""
        E2ELogger.test_start("User Registration Flow")

        E2ELogger.step("Navigate to registration page")
        page.goto(f"{TestConfig.BASE_URL}/register")
        page.wait_for_load_state("networkidle")

        username = f"newuser_{int(time.time())}"
        email = f"new_{int(time.time())}@example.com"

        E2ELogger.step(f"Fill registration form: {username}")
        page.fill("input[name='username']", username)
        page.fill("input[name='email']", email)
        page.fill("input[name='password']", "NewPass123!")
        page.fill("input[name='confirmPassword']", "NewPass123!")

        E2ELogger.screenshot(page, "registration_before_submit")

        E2ELogger.step("Submit registration")
        page.click("button[type='submit']")

        E2ELogger.step("Wait for redirect to feed")
        page.wait_for_url("**/feed", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(page, "registration_complete")
        E2ELogger.success("Registration flow completed successfully")

    def test_user_login_flow(self, page: Page, user1_page: Page):
        """Test Login-Flow"""
        E2ELogger.test_start("User Login Flow")

        E2ELogger.step("Logout first")
        page.goto(f"{TestConfig.BASE_URL}/feed")
        page.wait_for_load_state("networkidle")

        # Try to find and click logout
        if page.locator("text=Abmelden").is_visible():
            page.click("text=Abmelden")
            page.wait_for_url("**/login", timeout=TestConfig.DEFAULT_TIMEOUT)
            E2ELogger.success("Logged out")

        E2ELogger.step("Navigate to login page")
        page.goto(f"{TestConfig.BASE_URL}/login")

        E2ELogger.step(f"Fill login form: {TestConfig.USER1_USERNAME}")
        page.fill("input[name='username']", TestConfig.USER1_USERNAME)
        page.fill("input[name='password']", TestConfig.USER1_PASSWORD)

        E2ELogger.screenshot(page, "login_before_submit")

        E2ELogger.step("Submit login")
        page.click("button[type='submit']")

        E2ELogger.step("Wait for redirect to feed")
        page.wait_for_url("**/feed", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(page, "login_complete")
        E2ELogger.success("Login flow completed successfully")

    def test_registration_duplicate_username_error(self, page: Page, user1_page: Page):
        """Test Fehlermeldung bei doppeltem Username"""
        E2ELogger.test_start("Registration Duplicate Username Error")

        E2ELogger.step("Navigate to registration page")
        page.goto(f"{TestConfig.BASE_URL}/register")
        page.wait_for_load_state("networkidle")

        E2ELogger.step(f"Try to register with existing username: {TestConfig.USER1_USERNAME}")
        page.fill("input[name='username']", TestConfig.USER1_USERNAME)
        page.fill("input[name='email']", f"newemail_{int(time.time())}@example.com")
        page.fill("input[name='password']", "TestPass123!")
        page.fill("input[name='confirmPassword']", "TestPass123!")

        E2ELogger.screenshot(page, "duplicate_username_before_submit")

        E2ELogger.step("Submit registration")
        page.click("button[type='submit']")

        E2ELogger.step("Wait for error message")
        error_message = page.locator(".error")
        expect(error_message).to_be_visible(timeout=TestConfig.DEFAULT_TIMEOUT)
        error_text = error_message.text_content()

        E2ELogger.step(f"Verify error message: {error_text}")
        assert "Benutzername ist bereits vergeben" in error_text

        E2ELogger.screenshot(page, "duplicate_username_error_shown")
        E2ELogger.success("Duplicate username error message displayed correctly")

    def test_registration_duplicate_email_error(self, page: Page, user1_page: Page):
        """Test Fehlermeldung bei doppelter E-Mail"""
        E2ELogger.test_start("Registration Duplicate Email Error")

        E2ELogger.step("Navigate to registration page")
        page.goto(f"{TestConfig.BASE_URL}/register")
        page.wait_for_load_state("networkidle")

        E2ELogger.step(f"Try to register with existing email: {TestConfig.USER1_EMAIL}")
        page.fill("input[name='username']", f"newuser_{int(time.time())}")
        page.fill("input[name='email']", TestConfig.USER1_EMAIL)
        page.fill("input[name='password']", "TestPass123!")
        page.fill("input[name='confirmPassword']", "TestPass123!")

        E2ELogger.screenshot(page, "duplicate_email_before_submit")

        E2ELogger.step("Submit registration")
        page.click("button[type='submit']")

        E2ELogger.step("Wait for error message")
        error_message = page.locator(".error")
        expect(error_message).to_be_visible(timeout=TestConfig.DEFAULT_TIMEOUT)
        error_text = error_message.text_content()

        E2ELogger.step(f"Verify error message: {error_text}")
        assert "E-Mail-Adresse ist bereits registriert" in error_text

        E2ELogger.screenshot(page, "duplicate_email_error_shown")
        E2ELogger.success("Duplicate email error message displayed correctly")


class TestPostCreation:
    """E2E Tests für Post-Erstellung"""

    def test_create_simple_post(self, user1_page: Page):
        """Test einfachen Post erstellen"""
        E2ELogger.test_start("Create Simple Post")

        E2ELogger.step("Navigate to feed")
        user1_page.goto(f"{TestConfig.BASE_URL}/feed")
        user1_page.wait_for_load_state("networkidle")

        E2ELogger.step("Find post creation input")
        post_content = f"Das ist ein E2E Test-Post! 🚀 {int(time.time())}"
        user1_page.fill("textarea[placeholder*='Was möchtest du teilen']", post_content)

        E2ELogger.screenshot(user1_page, "before_post_submit")

        E2ELogger.step("Submit post")
        user1_page.click("button:has-text('Teilen')")

        E2ELogger.step("Wait for post to appear in feed")
        user1_page.wait_for_selector(f"text={post_content[:30]}", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "after_post_created")
        E2ELogger.success("Post created and visible in feed")

    def test_create_post_with_hashtag(self, user1_page: Page):
        """Test Post mit Hashtag erstellen"""
        E2ELogger.test_start("Create Post with Hashtag")

        E2ELogger.step("Navigate to feed")
        user1_page.goto(f"{TestConfig.BASE_URL}/feed")
        user1_page.wait_for_load_state("networkidle")

        post_content = f"Test-Post mit #e2etest #playwright {int(time.time())}"
        E2ELogger.step(f"Fill post: {post_content}")
        user1_page.fill("textarea[placeholder*='Was möchtest du teilen']", post_content)

        E2ELogger.step("Submit post")
        user1_page.click("button:has-text('Teilen')")

        E2ELogger.step("Wait for post with hashtag to appear")
        user1_page.wait_for_selector("text=#e2etest", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "post_with_hashtag")
        E2ELogger.success("Post with hashtag created successfully")


class TestComments:
    """E2E Tests für Kommentare"""

    def test_add_comment_to_post(self, user1_page: Page, user2_page: Page):
        """Test Kommentar zu Post hinzufügen"""
        E2ELogger.test_start("Add Comment to Post")

        # User 1 erstellt Post
        E2ELogger.step("User 1: Create post")
        user1_page.goto(f"{TestConfig.BASE_URL}/feed")
        user1_page.wait_for_load_state("networkidle")

        post_content = f"Post für Kommentar-Test {int(time.time())}"
        user1_page.fill("textarea[placeholder*='Was möchtest du teilen']", post_content)
        user1_page.click("button:has-text('Teilen')")
        user1_page.wait_for_selector(f"text={post_content[:30]}", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "user1_post_created")
        E2ELogger.success("User 1: Post created")

        # User 2 kommentiert
        E2ELogger.step("User 2: Navigate to feed and find post")
        user2_page.goto(f"{TestConfig.BASE_URL}/feed")
        user2_page.wait_for_load_state("networkidle")

        # Find the post and expand comments
        E2ELogger.step("User 2: Expand comments on post")
        post_card = user2_page.locator(f"text={post_content[:30]}").locator("..").locator("..")
        comment_button = post_card.locator("button:has-text('Kommentieren')")
        comment_button.click()

        E2ELogger.step("User 2: Add comment")
        comment_text = f"Toller Post! 👍 {int(time.time())}"
        comment_input = post_card.locator("input[placeholder*='Schreib einen Kommentar']")
        comment_input.fill(comment_text)

        E2ELogger.screenshot(user2_page, "user2_before_comment_submit")

        submit_button = post_card.locator("button:has-text('Senden')")
        submit_button.click()

        E2ELogger.step("Wait for comment to appear")
        user2_page.wait_for_selector(f"text={comment_text[:20]}", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user2_page, "user2_comment_added")
        E2ELogger.success("Comment added successfully")

    def test_guardian_modal_on_hate_speech_comment(self, user1_page: Page):
        """Test Guardian Modal bei Hatespeech-Kommentar"""
        E2ELogger.test_start("Guardian Modal on Hate Speech Comment")

        # User 1 erstellt Post
        E2ELogger.step("User 1: Create post")
        user1_page.goto(f"{TestConfig.BASE_URL}/feed")
        user1_page.wait_for_load_state("networkidle")

        post_content = f"Post für Guardian-Test {int(time.time())}"
        user1_page.fill("textarea[placeholder*='Was möchtest du teilen']", post_content)
        user1_page.click("button:has-text('Teilen')")
        user1_page.wait_for_selector(f"text={post_content[:30]}", timeout=TestConfig.DEFAULT_TIMEOUT)

        # Expand comments
        E2ELogger.step("Expand comments")
        post_card = user1_page.locator(f"text={post_content[:30]}").locator("..").locator("..")
        comment_button = post_card.locator("button:has-text('Kommentieren')")
        comment_button.click()

        # Try to add hate speech comment
        E2ELogger.step("Attempt to add hate speech comment")
        hate_speech = "Diese scheiss ausländer sollen verschwinden!"
        comment_input = post_card.locator("input[placeholder*='Schreib einen Kommentar']")
        comment_input.fill(hate_speech)

        E2ELogger.screenshot(user1_page, "before_hate_speech_submit")

        submit_button = post_card.locator("button:has-text('Senden')")
        submit_button.click()

        # Wait for Guardian Modal
        E2ELogger.step("Wait for Guardian Modal to appear")
        guardian_modal = user1_page.locator("text=Guardian").locator("..")
        expect(guardian_modal).to_be_visible(timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "guardian_modal_visible")
        E2ELogger.success("Guardian Modal appeared successfully")

        # Check for alternative suggestions
        E2ELogger.step("Check for alternative suggestions")
        alternatives = user1_page.locator(".alternative-btn")
        expect(alternatives.first).to_be_visible()

        E2ELogger.screenshot(user1_page, "guardian_modal_with_alternatives")
        E2ELogger.success("Alternative suggestions visible")

        # Click first alternative
        E2ELogger.step("Select first alternative")
        alternatives.first.click()

        # Wait for comment to be posted
        E2ELogger.step("Wait for alternative comment to be posted")
        time.sleep(2)  # Give time for submission

        E2ELogger.screenshot(user1_page, "after_alternative_selected")
        E2ELogger.success("Alternative selected and comment posted")


class TestNotifications:
    """E2E Tests für Benachrichtigungen"""

    def test_notification_on_like(self, user1_page: Page, user2_page: Page):
        """Test Benachrichtigung bei Like"""
        E2ELogger.test_start("Notification on Post Like")

        # User 1 erstellt Post
        E2ELogger.step("User 1: Create post")
        user1_page.goto(f"{TestConfig.BASE_URL}/feed")
        user1_page.wait_for_load_state("networkidle")

        post_content = f"Post für Notification-Test {int(time.time())}"
        user1_page.fill("textarea[placeholder*='Was möchtest du teilen']", post_content)
        user1_page.click("button:has-text('Teilen')")
        user1_page.wait_for_selector(f"text={post_content[:30]}", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.success("User 1: Post created")

        # User 2 liked Post
        E2ELogger.step("User 2: Navigate to feed and like post")
        user2_page.goto(f"{TestConfig.BASE_URL}/feed")
        user2_page.wait_for_load_state("networkidle")

        post_card = user2_page.locator(f"text={post_content[:30]}").locator("..").locator("..")
        like_button = post_card.locator("button:has-text('Like')")
        like_button.click()

        E2ELogger.screenshot(user2_page, "user2_liked_post")
        E2ELogger.success("User 2: Post liked")

        # User 1 prüft Benachrichtigungen
        E2ELogger.step("User 1: Check notifications")
        user1_page.reload()
        user1_page.wait_for_load_state("networkidle")

        notification_button = user1_page.locator("button:has-text('Benachrichtigungen')")

        # Wait for notification badge to appear
        E2ELogger.step("Wait for notification badge")
        notification_badge = user1_page.locator(".notification-badge")
        expect(notification_badge).to_be_visible(timeout=TestConfig.SLOW_TIMEOUT)

        E2ELogger.screenshot(user1_page, "user1_notification_badge")
        E2ELogger.success("Notification badge visible")

        # Click notifications
        E2ELogger.step("Open notifications dropdown")
        notification_button.click()

        E2ELogger.step("Wait for notification to appear in list")
        notification_item = user1_page.locator(f"text={TestConfig.USER2_USERNAME}").locator("..")
        expect(notification_item).to_be_visible(timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "user1_notifications_list")
        E2ELogger.success("Notification visible in dropdown")

    def test_notification_click_navigates_to_post(self, user1_page: Page, user2_page: Page):
        """Test: Klick auf Benachrichtigung navigiert zu Post und klappt Kommentare auf"""
        E2ELogger.test_start("Notification Click Navigation & Comment Expansion")

        # User 1 erstellt Post
        E2ELogger.step("User 1: Create post")
        user1_page.goto(f"{TestConfig.BASE_URL}/feed")
        user1_page.wait_for_load_state("networkidle")

        post_content = f"Post für Navigation-Test {int(time.time())}"
        user1_page.fill("textarea[placeholder*='Was möchtest du teilen']", post_content)
        user1_page.click("button:has-text('Teilen')")
        user1_page.wait_for_selector(f"text={post_content[:30]}", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.success("User 1: Post created")

        # User 2 kommentiert
        E2ELogger.step("User 2: Comment on post")
        user2_page.goto(f"{TestConfig.BASE_URL}/feed")
        user2_page.wait_for_load_state("networkidle")

        post_card = user2_page.locator(f"text={post_content[:30]}").locator("..").locator("..")
        comment_button = post_card.locator("button:has-text('Kommentieren')")
        comment_button.click()

        comment_text = f"Test-Kommentar {int(time.time())}"
        comment_input = post_card.locator("input[placeholder*='Schreib einen Kommentar']")
        comment_input.fill(comment_text)
        submit_button = post_card.locator("button:has-text('Senden')")
        submit_button.click()

        user2_page.wait_for_selector(f"text={comment_text[:20]}", timeout=TestConfig.DEFAULT_TIMEOUT)
        E2ELogger.success("User 2: Comment added")

        # User 1 navigiert woanders hin
        E2ELogger.step("User 1: Navigate away from feed")
        user1_page.goto(f"{TestConfig.BASE_URL}/search")
        user1_page.wait_for_load_state("networkidle")

        # User 1 öffnet Benachrichtigungen
        E2ELogger.step("User 1: Open notifications")
        time.sleep(2)  # Wait for notification to be created
        user1_page.reload()
        user1_page.wait_for_load_state("networkidle")

        notification_button = user1_page.locator("button:has-text('Benachrichtigungen')")
        notification_button.click()

        # Click on notification
        E2ELogger.step("User 1: Click on notification")
        notification_item = user1_page.locator(f"text={TestConfig.USER2_USERNAME}").locator("..").first
        notification_item.click()

        # Should navigate to my-posts with post highlighted
        E2ELogger.step("Wait for navigation to my-posts")
        user1_page.wait_for_url("**/my-posts**", timeout=TestConfig.DEFAULT_TIMEOUT)

        # Check if post is highlighted
        E2ELogger.step("Check if post is highlighted")
        highlighted_post = user1_page.locator(".highlighted-post")
        expect(highlighted_post).to_be_visible(timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "post_highlighted")
        E2ELogger.success("Post highlighted")

        # Check if comments are expanded
        E2ELogger.step("Check if comments are expanded")
        comment_section = user1_page.locator(f"text={comment_text[:20]}")
        expect(comment_section).to_be_visible(timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "comments_expanded")
        E2ELogger.success("Comments auto-expanded successfully")


class TestUserSearch:
    """E2E Tests für Benutzersuche"""

    def test_search_for_user(self, user1_page: Page, user2_page: Page):
        """Test Benutzer suchen"""
        E2ELogger.test_start("Search for User")

        E2ELogger.step("Navigate to search page")
        user1_page.goto(f"{TestConfig.BASE_URL}/search")
        user1_page.wait_for_load_state("networkidle")

        E2ELogger.step(f"Search for: {TestConfig.USER2_USERNAME}")
        search_input = user1_page.locator("input[placeholder*='Benutzer suchen']")
        search_input.fill(TestConfig.USER2_USERNAME)

        E2ELogger.step("Wait for search results")
        user1_page.wait_for_selector(f"text={TestConfig.USER2_USERNAME}", timeout=TestConfig.DEFAULT_TIMEOUT)

        E2ELogger.screenshot(user1_page, "search_results")
        E2ELogger.success("User found in search results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--headed"])
