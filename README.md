# SafeSpace - Social Network with AI-Powered Moderation

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.io/)

SafeSpace is a privacy-focused social network with AI-powered content moderation using DeepSeek. The project combines a scalable microservice architecture with a multi-tiered moderation system.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Admin & Moderation](#admin--moderation)
- [Visibility System](#visibility-system)
- [SafeSpace Moderation Pipeline](#safespace-moderation-pipeline)
- [Known Bugs & Limitations](#known-bugs--limitations)
- [Development](#development)
- [License](#license)

---

## Features

### Core Features
- **User Registration & JWT Authentication** - Secure login with token-based auth
- **Feed with Auto-Refresh** - Posts from friends are updated every 30 seconds
- **Create, Edit, Delete Posts** - Full CRUD operations
- **Comments & Likes** - Interact with posts
- **Media Upload** - Images and videos with automatic thumbnail generation
- **Friendship System** - With relationship types (Family, Close Friends, Acquaintances)

### Moderation & Safety
- **AI-Powered Hate Speech Detection** - Automatic analysis via DeepSeek
- **Live Check While Typing** - Warning before posting problematic content
- **Revision Suggestions** - AI suggests alternative phrasings
- **User Reports** - Community can report inappropriate posts
- **Admin Dashboard** - Overview for moderators with quick actions
- **Multi-Tier Role System** - User, Moderator, Admin

### Visibility & Privacy
- 🌍 **Public** - Everyone can see the post
- 👋 **Acquaintances** - Only acquaintances and above
- 💚 **Close Friends** - Only close friends and family
- 👨‍👩‍👧 **Family** - Only family members
- 🔒 **Private** - Only the author

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Angular Frontend                                │
│              (Auto-Refresh 30s + SafeSpace Live-Check)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                                  │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│  Auth API   │  Feed API   │ Friends API │  Media API  │ SafeSpace API  │
└─────────────┴─────────────┴─────────────┴─────────────┴────────────────┘
      │             │              │             │              │
      ▼             ▼              ▼             ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│PostgreSQL│  │  Redis   │  │  SQLite  │  │  MinIO   │  │    Kafka     │
│ (Users)  │  │ (Cache)  │  │ (Posts)  │  │ (Media)  │  │   (Queue)    │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────┐
                                                    │ SafeSpace Worker │
                                                    │    (DeepSeek)    │
                                                    └──────────────────┘
```

### Database Structure

| Storage | Usage |
|---------|-------|
| **PostgreSQL** | Users, Friendships, Reports, Moderation Log, Roles |
| **SQLite (per User)** | Posts of the respective user (`/data/users/{uid}/posts.db`) |
| **Redis** | Feed cache with 30s TTL |
| **MinIO** | Media files and SafeSpace reports (JSON) |
| **Kafka** | Message queue for asynchronous moderation |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.11+, psycopg3, aiosqlite, aiokafka |
| **Frontend** | Angular 18, Standalone Components, Signals, RxJS |
| **Databases** | PostgreSQL 16, SQLite, Redis 7 |
| **Storage** | MinIO (S3-compatible) |
| **Queue** | Apache Kafka + Zookeeper |
| **AI** | DeepSeek API |
| **Container** | Docker, Docker Compose |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- DeepSeek API Key (for AI moderation)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/safespace.git
cd safespace

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add your DEEPSEEK_API_KEY

# 3. Start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f backend
```

### Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Admin Dashboard | http://localhost:4200/admin |
| Kafka UI | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

### Create Admin User

```bash
# Create admin
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-admin admin admin@example.com securePassword123

# Create moderator
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-moderator mod1 mod1@example.com password123

# Promote existing user
docker exec -it socialnet-backend python -m app.cli.manage_users \
  promote username moderator
```

---

## Configuration

### Environment Variables (.env)

```env
# PostgreSQL
POSTGRES_PASSWORD=changeme
POSTGRES_DB=socialnet
POSTGRES_USER=socialnet

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here

# DeepSeek API (REQUIRED for AI moderation)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Optional: Worker count for production
WORKERS=4
```

### Multi-Core Optimization (Production)

The backend uses Uvicorn by default. For production with Gunicorn:

```yaml
# docker-compose.yml
backend:
  command: gunicorn app.main:app -c gunicorn.conf.py
  environment:
    - WORKERS=8  # Number of CPU cores
```

---

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login, returns JWT |
| `/api/auth/me` | GET | Get current user |

### Feed & Posts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feed` | GET | Load feed (cached) |
| `/api/posts` | POST | Create new post |
| `/api/posts/{id}` | DELETE | Delete own post |
| `/api/posts/{id}/like` | POST | Like a post |
| `/api/posts/{id}/comments` | POST | Add comment |

### SafeSpace Moderation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/safespace/check` | POST | Check content before posting |
| `/api/safespace/suggest-revision` | POST | Generate revision suggestion |
| `/api/safespace/stats/user/{uid}` | GET | User moderation statistics |

### Admin (Moderator/Admin only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/dashboard` | GET | Dashboard statistics |
| `/api/admin/reports` | GET | List open reports |
| `/api/admin/reports/{id}/assign` | POST | Claim report |
| `/api/admin/reports/{id}/resolve` | POST | Resolve report |
| `/api/admin/users/{uid}/suspend` | POST | Suspend user |
| `/api/admin/users/{uid}/role` | POST | Change role (Admin only) |

---

## Admin & Moderation

### Role System

| Role | Permissions |
|------|-------------|
| **user** | Standard user, can post and report |
| **moderator** | Process reports, delete posts, suspend users |
| **admin** | Everything + assign roles |

### Moderator Workflow

1. **Report Received** - User reports post via ⋮ menu
2. **Claim** - Moderator assigns report to themselves
3. **Review** - Check post and AI analysis
4. **Action** - Approve / Delete / Suspend User / Dismiss

### Report Categories

- `hate_speech` - Hate speech
- `harassment` - Harassment
- `spam` - Spam
- `inappropriate` - Inappropriate content
- `other` - Other

---

## Visibility System

Posts can be created with different visibility levels:

| Level | Who Can See | Relationship Types |
|-------|-------------|-------------------|
| `public` | Everyone | - |
| `acquaintance` | Acquaintances + above | acquaintance, close_friend, family |
| `close_friend` | Close friends + above | close_friend, family |
| `family` | Family only | family |
| `private` | Author only | - |

### Relationship Types for Friends

When adding friends, you can choose the relationship type:
- **Family** (`family`)
- **Close Friends** (`close_friend`)
- **Acquaintances** (`acquaintance`)

---

## SafeSpace Moderation Pipeline

### Flow

```
User types post
       │
       ▼
┌──────────────────┐
│ Live Check       │ ← Debounced after 1s pause
│ (Frontend)       │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ POST /safespace/ │
│ check            │
└──────────────────┘
       │
       ▼
┌──────────────────┐     ┌──────────────────┐
│ DeepSeek API     │────▶│ Show Warning     │
│ Analysis         │     │ + Suggestion     │
└──────────────────┘     └──────────────────┘
       │
       ▼
User posts (or corrects)
       │
       ▼
┌──────────────────┐
│ Kafka Queue      │
│ (Async)          │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ SafeSpace Worker │
│ (Background)     │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Report → MinIO   │
│ (JSON)           │
└──────────────────┘
```

### Hate Speech Categories

| Category | Description |
|----------|-------------|
| 🔴 `racism` | Racism |
| 🔴 `sexism` | Sexism |
| 🔴 `homophobia` | Homophobia |
| 🔴 `religious_hate` | Religious hatred |
| 🔴 `xenophobia` | Xenophobia |
| 🔴 `threat` | Threats |
| 🔴 `harassment` | Harassment |

### Automatic Actions

| Score | Status | Action |
|-------|--------|--------|
| < 0.7 | ✅ approved | Post remains visible |
| 0.7 - 0.9 | ⚠️ flagged | Marked for review |
| > 0.9 | 🚫 blocked | Automatically blocked |

---

## Known Bugs & Limitations

### 🔴 Critical Bugs

| Bug | Description | Workaround |
|-----|-------------|------------|
| **401 Login Error (Local Dev)** | Login fails with 401 when backend runs locally but proxy points to Docker hostname. | **FIXED**: `proxy.conf.json` now points to `localhost:8000`. For Docker, use `proxy.conf.docker.json`. See [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md). |
| **401 after Registration** | After registration, no automatic login is performed. User receives 401 when accessing feed. | Manually log in at `/login` OR use the updated `register.component.ts` with auto-login. |
| **Kafka Cluster ID Mismatch** | After container restarts, Kafka and Zookeeper may have different cluster IDs. | `docker volume rm socialnet_kafka_data && docker-compose up -d` |

### 🟡 Known Limitations

| Limitation | Description | Status |
|------------|-------------|--------|
| **WebSocket HMR Error** | Development server shows WebSocket errors for Hot Module Replacement. | Not a functional bug, only affects dev mode. |
| **Proxy Configuration** | Frontend proxy must point to `http://localhost:8000` (local dev) or `http://socialnet-backend:8000` (Docker). | See [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md) for details. |
| **SQLite Scaling** | With many friends (>1000), feed aggregation may become slow. | Redis caching is active, but pagination may be needed for large networks. |
| **DeepSeek Rate Limits** | API has rate limits; moderation checks may be delayed under high traffic. | Queue-based processing buffers automatically. |

### 🟢 Fixed Bugs (History)

| Bug | Solution |
|-----|----------|
| bcrypt/passlib Crash | Backend Dockerfile now uses `bcrypt==4.0.1` with correct build. |
| Feed Cache Not Invalidated | `FeedService.invalidate_feed()` is now called after post creation. |
| CORS Errors | Backend has complete CORS middleware with correct origins. |

---

## Development

> **🔧 Lokale Entwicklung ohne Docker?**
> Siehe [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md) für detaillierte Anweisungen zum Starten des Backends und Frontends lokal, inkl. Problemlösung für 401-Login-Fehler.

### Project Structure

```
safespace/
├── docker-compose.yml          # Service orchestration
├── .env.example                # Environment variables template
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI App
│       ├── api/                # API Routers
│       │   ├── auth.py
│       │   ├── feed.py
│       │   ├── friends.py
│       │   ├── media.py
│       │   └── admin.py
│       ├── db/                 # Database handlers
│       │   ├── postgres.py
│       │   ├── sqlite.py
│       │   └── moderation.py
│       ├── cache/
│       │   └── redis_cache.py
│       ├── services/
│       │   ├── feed_service.py
│       │   └── auth_service.py
│       ├── safespace/          # AI Moderation
│       │   ├── config.py
│       │   ├── models.py
│       │   ├── kafka_service.py
│       │   ├── minio_service.py
│       │   ├── deepseek_moderator.py
│       │   ├── worker.py
│       │   └── api.py
│       └── cli/
│           └── manage_users.py
│
└── frontend/
    ├── Dockerfile.dev
    ├── proxy.conf.json
    └── src/app/
        ├── services/
        │   ├── auth.service.ts
        │   ├── feed.service.ts
        │   └── admin.service.ts
        ├── components/
        │   ├── feed/
        │   ├── login/
        │   ├── register/
        │   ├── create-post/
        │   └── admin/
        ├── guards/
        │   └── auth.guard.ts
        └── interceptors/
            └── auth.interceptor.ts
```

### Local Development

```bash
# Start backend separately (with hot-reload)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend separately
cd frontend
npm install
ng serve --proxy-config proxy.conf.json
```

### Run Tests

```bash
# Backend tests
docker exec -it socialnet-backend pytest

# Test auth flow
./test-auth-flow-detailed.sh
```

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

This means:
- ✅ You may use, modify, and distribute the code
- ✅ You may use the code commercially
- ⚠️ Modifications must be published under AGPL
- ⚠️ When providing as a web service, source code must be available

See [LICENSE](LICENSE) for the full license text.

---

## Contributing

Pull requests are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Contact & Support

For questions or issues:
- Open GitHub Issues
- Check documentation in `/docs`
- API Docs at http://localhost:8000/docs

---

*Built with ❤️ and AI-powered moderation*
