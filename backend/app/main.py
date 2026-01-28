from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import PostgresDB
from app.cache.redis_cache import RedisCache
from app.api import auth, feed, friends, media
from app.api.admin import router as admin_router
from app.api.reports import router as reports_router
from app.api.users import router as users_router
from app.api.hashtags import router as hashtags_router
from app.api.translation import router as translation_router
from app.api.public_feed import router as public_feed_router
from app.api.welcome import router as welcome_router
from app.api.broadcast import router as broadcast_router
from app.api.notifications import router as notifications_router
from app.safespace.api import router as safespace_router
from app.api.groups import router as groups_router
from app.api.link_preview import router as link_preview_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup und Shutdown Events"""
    # Startup
    await PostgresDB.init_pool()
    await RedisCache.init()
    print("✅ Database and Redis connections initialized")

    # Welcome Message Tabellen erstellen
    try:
        from app.db.welcome_message import create_welcome_tables
        await create_welcome_tables()
        print("✅ Welcome message tables initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize welcome tables: {e}")

    # Broadcast Posts Tabellen erstellen
    try:
        from app.db.broadcast_posts import create_broadcast_tables
        await create_broadcast_tables()
        print("✅ Broadcast posts tables initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize broadcast tables: {e}")

    # Notifications Tabelle erstellen
    try:
        from app.db.notifications import create_notifications_table
        await create_notifications_table()
        print("✅ Notifications table initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize notifications table: {e}")
    
    # Site Settings Tabelle erstellen
    try:
        from app.db.site_settings import init_site_settings_table
        await init_site_settings_table()
        print("✅ Site settings table initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize site settings table: {e}")

    # Kafka Producer initialisieren (optional, falls verfügbar)
    try:
        from app.safespace.kafka_service import KafkaService
        await KafkaService.init_producer()
        print("✅ Kafka Producer initialized")
    except Exception as e:
        print(f"⚠️ Kafka not available: {e}")

    # Birthday Notification Scheduler starten
    try:
        from app.services.birthday_service import start_birthday_scheduler
        start_birthday_scheduler()
    except Exception as e:
        print(f"⚠️ Failed to start birthday scheduler: {e}")

    yield
    
    # Shutdown
    try:
        from app.safespace.kafka_service import KafkaService
        await KafkaService.close_producer()
    except:
        pass
    
    await PostgresDB.close_pool()
    await RedisCache.close()
    print("👋 Connections closed")


app = FastAPI(
    title="Social Network API",
    description="Ein Facebook-ähnliches Social Network mit PostgreSQL, SQLite und Redis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS für Angular Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",  # Angular dev server
        "http://localhost:8080",  # Alternative
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router registrieren
app.include_router(auth.router, prefix="/api")
app.include_router(feed.router, prefix="/api")
app.include_router(friends.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(hashtags_router, prefix="/api")
app.include_router(translation_router, prefix="/api")
app.include_router(public_feed_router, prefix="/api")
app.include_router(welcome_router, prefix="/api")
app.include_router(broadcast_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(safespace_router, prefix="/api")
app.include_router(groups_router, prefix="/api")
app.include_router(link_preview_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "message": "Social Network API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health Check für Docker/Kubernetes"""
    return {"status": "healthy"}


@app.get("/api/site-settings/title")
async def get_public_site_title():
    """Öffentlicher Endpunkt für den Site-Titel"""
    from app.db.site_settings import get_site_title
    title = await get_site_title()
    return {"site_title": title}
