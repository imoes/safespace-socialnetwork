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
from app.safespace.api import router as safespace_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup und Shutdown Events"""
    # Startup
    await PostgresDB.init_pool()
    await RedisCache.init()
    print("✅ Database and Redis connections initialized")
    
    # Kafka Producer initialisieren (optional, falls verfügbar)
    try:
        from app.safespace.kafka_service import KafkaService
        await KafkaService.init_producer()
        print("✅ Kafka Producer initialized")
    except Exception as e:
        print(f"⚠️ Kafka not available: {e}")
    
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
app.include_router(safespace_router, prefix="/api")


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
