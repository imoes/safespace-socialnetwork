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
- **Feed with Auto-Refresh** - Posts from friends are updated every 30 seconds (25 posts per page)
- **Create, Edit, Delete Posts** - Full CRUD operations with visibility control
- **Personal Posts** - Write posts on other users' profiles (visible on their timeline)
- **Comments & Likes** - Interact with posts and like individual comments
- **Media Upload** - Images and videos with multipart/form-data support
- **Profile Pictures** - Upload and display custom profile pictures (max 10MB)
- **Enhanced User Search** - Real-time search with profile pictures and friends-first sorting
- **User Profiles** - View profiles with bio, name, role, and friend request option
- **Friendship System** - With relationship types (Family, Close Friends, Acquaintances)
- **Unfriend Functionality** - Remove friendships with confirmation dialog
- **Hashtag System** - Automatic extraction, trending hashtags, and clickable hashtags in posts
- **Public Posts Feed** - Discover community posts with 25 posts per page pagination
- **My Posts with Tabs** - View your own posts and posts you've commented on
- **Post Translation** - Translate posts to German using Google Translate API (18 languages supported)
- **Multi-Language UI** - 6 languages (English, German, Spanish, Italian, French, Arabic with RTL)
- **Account Deletion** - Permanently delete account with all data (posts, media, friendships)
- **OpenSearch Integration** - Full-text search for public posts with hashtag aggregations

### Moderation & Safety
- **Guardian AI Moderation System** - Educational approach with modal after clicking "Post"
  - Explanation of why content was flagged
  - 2 clickable alternative formulations
  - Custom text field for user's own revision
  - Dispute button to appeal to human moderator
  - AI disclaimer warning about potential errors
- **SimpleModerator Fallback** - Keyword-based moderation when DeepSeek API unavailable (402 error)
- **Alternative Suggestions** - AI provides multiple ways to rephrase problematic content
- **Check on Submit** - Moderation check only when clicking "Post" button (reduces API traffic)
- **User Reports** - Community can report inappropriate posts with categories
- **Moderation Disputes** - Users can dispute AI decisions for human review
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
├───────────┬───────────┬────────────┬───────────┬─────────────┬──────────┤
│ Auth API  │ Feed API  │Friends API │ Media API │SafeSpace API│Users/Tags│
└───────────┴───────────┴────────────┴───────────┴─────────────┴──────────┘
      │          │            │            │            │            │
      ▼          ▼            ▼            ▼            ▼            ▼
┌──────────┐┌─────────┐┌──────────┐┌──────────┐┌──────────┐┌────────────┐
│PostgreSQL││  Redis  ││  SQLite  ││  MinIO   ││  Kafka   ││ OpenSearch │
│ (Users)  ││ (Cache) ││ (Posts)  ││ (Media)  ││ (Queue)  ││  (Search)  │
└──────────┘└─────────┘└──────────┘└──────────┘└──────────┘└────────────┘
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
| **PostgreSQL** | Users (with profile_picture, first_name, last_name), Friendships, Reports, Moderation Log, Roles |
| **SQLite (per User)** | Posts of the respective user with comment likes (`/data/users/{uid}/posts.db`) |
| **Redis** | Feed cache with 30s TTL |
| **MinIO** | Media files (images/videos) and SafeSpace reports (JSON) |
| **Kafka** | Message queue for asynchronous moderation |
| **OpenSearch** | Full-text search index for public posts with hashtag extraction and aggregation |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.11+, psycopg3, aiosqlite, aiokafka, opensearch-py |
| **Frontend** | Angular 18, Standalone Components, Signals, RxJS |
| **Databases** | PostgreSQL 16, SQLite, Redis 7 |
| **Search** | OpenSearch 2.11 |
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
git clone https://github.com/imoes/safespace.git
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
| **Frontend** | http://localhost:4200 |
| **Backend API** | http://localhost:8000 |
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **Admin Dashboard** | http://localhost:4200/admin |
| **Settings** | http://localhost:4200/settings |
| **My Posts** | http://localhost:4200/my-posts |
| **Public Feed** | http://localhost:4200/public-feed |
| **Hashtags** | http://localhost:4200/hashtags |
| OpenSearch | http://localhost:9200 |
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
| `/api/feed` | GET | Load feed (cached, default 25 posts, max 50) |
| `/api/feed/with-media` | POST | Create post with media files (multipart/form-data) |
| `/api/posts` | POST | Create new post (auto-indexes in OpenSearch if public) |
| `/api/posts/{id}` | DELETE | Delete own post |
| `/api/posts/{id}` | PUT | Update post content |
| `/api/posts/{id}/visibility` | PUT | Update post visibility |
| `/api/posts/{id}/like` | POST | Like a post |
| `/api/posts/{id}/comments` | POST | Add comment |
| `/api/posts/{id}/comments` | GET | Get comments for a post |
| `/api/posts/{author_uid}/{post_id}/comments/{comment_id}` | PUT | Update comment content |
| `/api/posts/{author_uid}/{post_id}/comments/{comment_id}` | DELETE | Delete comment |
| `/api/posts/{author_uid}/{post_id}/comments/{comment_id}/like` | POST | Like a comment |
| `/api/posts/{author_uid}/{post_id}/comments/{comment_id}/unlike` | DELETE | Unlike a comment |
| `/api/public-feed` | GET | Get public posts (25 per page with pagination) |

### Users & Profiles

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/search?q={query}` | GET | Search for users by username (min 2 chars, friends-first sorting) |
| `/api/users/{uid}` | GET | Get user profile (username, bio, role, name, profile picture) |
| `/api/users/{uid}/posts` | GET | Get user's posts (visibility-aware, 25 per page) |
| `/api/users/{uid}/posts` | POST | Create personal post on user's profile |
| `/api/users/me` | PUT | Update own profile (email, bio, first_name, last_name, password) |
| `/api/users/me/profile-picture` | POST | Upload profile picture (max 10MB, images only) |
| `/api/users/me/posts` | GET | Get own posts (all visibility levels, 25 per page) |
| `/api/users/me/commented-posts` | GET | Get posts where user has commented (25 per page) |
| `/api/users/me/account` | DELETE | Permanently delete account with all data |

### Hashtags & Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hashtags/trending` | GET | Get top 20 trending hashtags from public posts |
| `/api/hashtags/search/{hashtag}` | GET | Search public posts by hashtag (top 50 results) |

### SafeSpace Moderation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/safespace/check` | POST | Check content before posting (returns alternatives) |
| `/api/safespace/suggest-revision` | POST | Generate revision suggestion |
| `/api/safespace/dispute` | POST | User disputes AI moderation decision |
| `/api/safespace/stats/user/{uid}` | GET | User moderation statistics |

### Translation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/translate` | POST | Translate text to target language (18 languages supported) |
| `/api/translate/languages` | GET | Get list of supported languages |

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

## Multi-Language Support (i18n)

SafeSpace supports **6 languages** with automatic browser detection and user preferences:

### Supported Languages

| Language | Code | Native Name | Flag | RTL Support |
|----------|------|-------------|------|-------------|
| English | `en` | English | 🇬🇧 | No |
| German | `de` | Deutsch | 🇩🇪 | No |
| Spanish | `es` | Español | 🇪🇸 | No |
| Italian | `it` | Italiano | 🇮🇹 | No |
| French | `fr` | Français | 🇫🇷 | No |
| Arabic | `ar` | العربية | 🇸🇦 | **Yes** |

### Features

- **Browser Language Detection** - Automatically detects and sets user's browser language on first visit
- **User Preference** - Change language in Settings and save to localStorage
- **Translation Files** - All translations in `/assets/i18n/{language}.json` for easy extension
- **Template Interpolation** - Support for parameters like `{{count}}` in translations
- **RTL Support** - Automatic HTML `dir="rtl"` for right-to-left languages (Arabic)
- **Dynamic HTML Attributes** - Sets `lang` attribute dynamically

### Adding New Languages

1. Create new translation file: `/frontend/src/assets/i18n/newlanguage.json`
2. Copy structure from `english.json`
3. Translate all keys
4. Add language to `I18nService.languages` array with code, name, flag

### Translation Service Usage

```typescript
// In any component
i18n = inject(I18nService);

// In template
{{ i18n.t('nav.feed') }}
{{ i18n.t('feed.postsCount', {current: 10, total: 100}) }}

// Change language programmatically
i18n.setLanguage('de');

// Get current language
const currentLang = i18n.currentLanguage();
```

---

## Post Translation

Posts can be translated using Google Translate API:

### Features

- **18 Languages Supported** - German, English, Spanish, French, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Turkish, Polish, Dutch, Swedish, Danish, Norwegian, Finnish
- **Toggle Translation** - Click translate button to switch between original and translated text
- **Visual Indicators** - Shows language flags and "Translated" badge
- **Automatic Language Detection** - Detects source language automatically
- **Cached Translations** - Translation is cached per post for faster subsequent views
- **Graceful Fallback** - Shows original text if translation fails

### Usage

1. Click 🌐 **Übersetzen** button on any post
2. Post content is translated to German (configurable)
3. Shows language flags: 🇬🇧 → 🇩🇪
4. Click 📝 **Original** to switch back

---

## OpenSearch Integration & Hashtags

### How It Works

**Automatic Indexing:**
- When a user creates a **public** post, it's automatically indexed in OpenSearch
- Hashtags are extracted using regex pattern `#(\w+)`
- Post metadata includes: author username, first_name, last_name, content, hashtags, timestamp
- Each indexed document gets a unique `opensearch_doc_id` stored in SQLite

**Visibility Changes:**
- Changing post from public → private: removes from OpenSearch index
- Changing post from private → public: adds to OpenSearch index

### Hashtag Features

**Trending Hashtags:**
- Aggregates top 20 most-used hashtags across all public posts
- Real-time counts from OpenSearch aggregations
- Accessed via `/api/hashtags/trending`

**Search by Hashtag:**
- Search public posts containing a specific hashtag
- Returns top 50 most recent matches
- Full post details with author information
- Accessed via `/api/hashtags/search/{hashtag}`

**User Search:**
- Real-time user search in navbar (min 2 characters)
- Search by username with ILIKE pattern matching
- Click result to view profile page
- Shows username, bio, and avatar

### OpenSearch Configuration

```yaml
# docker-compose.yml
opensearch:
  image: opensearchproject/opensearch:2.11.1
  environment:
    - discovery.type=single-node
    - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
    - plugins.security.disabled=true  # Development only!
  ports:
    - "9200:9200"
```

**Production Note:** For production, enable security plugin and configure proper authentication!

---

## SafeSpace Moderation Pipeline

### Guardian Moderation Flow (New)

```
User writes post and clicks "Post" button
       │
       ▼
┌──────────────────────────────────────┐
│ POST /safespace/check                │
│ (Only on submit, not while typing)   │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Try DeepSeek API                     │
└──────────────────────────────────────┘
       │
       ├─ Success ─▶ Continue
       │
       └─ 402 Error ─▶ Fallback to SimpleModerator
                       (Keyword-based detection)
       │
       ▼
Is hate speech detected?
       │
       ├─ No ──▶ Post immediately
       │
       └─ Yes ─▶ Show Guardian Modal
                  │
                  ├─ Explanation (why flagged)
                  ├─ Category badges
                  ├─ 2 clickable alternatives
                  ├─ Custom text field
                  ├─ Dispute button → Human review
                  └─ AI disclaimer
                  │
                  ▼
                User chooses:
                  ├─ Use alternative → Post with revision
                  ├─ Write custom text → Post with custom
                  ├─ Dispute → Submit to moderator queue
                  └─ Cancel → Don't post
```

### SimpleModerator Fallback

When DeepSeek API is unavailable (402 Payment Required), the system automatically falls back to `SimpleModerator`:

**Features:**
- **Keyword-based detection** for German hate speech patterns
- **6 Categories**: Racism, Xenophobia, Sexism, Homophobia, Threats, General Hate
- **Alternative suggestions** using template-based responses
- **Confidence scoring** based on number of matched categories
- **No external API dependency** - works offline

**Keyword Categories:**
```python
HATE_KEYWORDS = {
    "racism": ["rassist", "n-wort", "schwarze"],
    "xenophobia": ["ausländer raus", "asylanten"],
    "sexism": ["frauen gehören", "typisch frau"],
    "homophobia": ["schwuchtel", "homo"],
    "threat": ["ich kill", "umbringen"],
    "general_hate": ["abschaum", "dreckig"]
}
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
| **401 Login Error** | Login fails with 401 when proxy configuration doesn't match the deployment method. | **FIXED**: `proxy.conf.json` now points to `backend:8000` (Docker service name). For local dev, see [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md). For Docker, see [DOCKER-ENTWICKLUNG.md](DOCKER-ENTWICKLUNG.md). |
| **401 after Registration** | After registration, no automatic login is performed. User receives 401 when accessing feed. | Manually log in at `/login` OR use the updated `register.component.ts` with auto-login. |
| **Kafka Cluster ID Mismatch** | After container restarts, Kafka and Zookeeper may have different cluster IDs. | `docker volume rm socialnet_kafka_data && docker-compose up -d` |

### 🟡 Known Limitations

| Limitation | Description | Status |
|------------|-------------|--------|
| **WebSocket HMR Error** | Development server shows WebSocket errors for Hot Module Replacement. | Not a functional bug, only affects dev mode. |
| **Proxy Configuration** | Frontend proxy must match deployment: `http://localhost:8000` (local) or `http://backend:8000` (Docker service name). | See [DOCKER-ENTWICKLUNG.md](DOCKER-ENTWICKLUNG.md) or [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md) for details. |
| **SQLite Scaling** | With many friends (>1000), feed aggregation may become slow. | Redis caching is active, but pagination may be needed for large networks. |
| **DeepSeek Rate Limits** | API has rate limits; moderation checks may be delayed under high traffic. | Queue-based processing buffers automatically. |

### 🟢 Fixed Bugs (History)

| Bug | Solution |
|-----|----------|
| bcrypt/passlib Crash | Backend Dockerfile now uses `bcrypt==4.0.1` with correct build. |
| Feed Cache Not Invalidated | `FeedService.invalidate_feed()` is now called after post creation. |
| CORS Errors | Backend has complete CORS middleware with correct origins. |
| **Image Upload 422 Error** | Fixed `/api/feed/with-media` endpoint by adding `Form()` decorators for proper multipart/form-data handling. |
| **DeepSeek API 402 Error** | Implemented `SimpleModerator` fallback with keyword-based detection when API is unavailable. |
| **Guardian Modal Spam** | Changed from real-time checking to check-on-submit (only when clicking "Post" button) to reduce API traffic. |

---

## Development

> **🐳 Docker-Entwicklung?**
> Siehe [DOCKER-ENTWICKLUNG.md](DOCKER-ENTWICKLUNG.md) für detaillierte Anweisungen zur Entwicklung mit Docker Compose, inkl. Problemlösung für 401-Login-Fehler.
>
> **💻 Lokale Entwicklung ohne Docker?**
> Siehe [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md) für Anweisungen zum Starten des Backends und Frontends direkt auf Ihrem System.

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
│       │   ├── admin.py
│       │   ├── users.py        # User search, profiles, settings, account deletion
│       │   ├── hashtags.py     # Hashtag trending & search
│       │   ├── translation.py  # Post translation API
│       │   ├── public_feed.py  # Public posts feed
│       │   └── reports.py      # User reporting system
│       ├── db/                 # Database handlers
│       │   ├── postgres.py
│       │   ├── sqlite_posts.py # Posts + comment likes
│       │   └── moderation.py
│       ├── cache/
│       │   └── redis_cache.py
│       ├── services/
│       │   ├── feed_service.py
│       │   ├── auth_service.py
│       │   ├── media_service.py
│       │   ├── opensearch_service.py  # OpenSearch integration
│       │   └── translation_service.py # Google Translate integration
│       ├── safespace/          # AI Moderation
│       │   ├── config.py
│       │   ├── models.py
│       │   ├── kafka_service.py
│       │   ├── minio_service.py
│       │   ├── deepseek_moderator.py
│       │   ├── simple_moderator.py    # Fallback moderator
│       │   ├── worker.py
│       │   └── api.py
│       └── cli/
│           └── manage_users.py
│
└── frontend/
    ├── Dockerfile.dev
    ├── proxy.conf.json
    └── src/
        ├── assets/i18n/             # Translation files
        │   ├── english.json
        │   ├── german.json
        │   ├── spanish.json
        │   ├── italian.json
        │   ├── french.json
        │   └── arabic.json
        └── app/
            ├── services/
            │   ├── auth.service.ts
            │   ├── feed.service.ts
            │   ├── user.service.ts       # User search & profiles
            │   ├── hashtag.service.ts    # Hashtag trending & search
            │   ├── translation.service.ts # Post translation
            │   ├── i18n.service.ts       # Multi-language support
            │   ├── safespace.service.ts  # Moderation API
            │   ├── report.service.ts     # User reporting
            │   └── admin.service.ts
            ├── components/
            │   ├── feed/
            │   ├── login/
            │   ├── register/
            │   ├── create-post/          # With Guardian modal
            │   ├── post-card/            # With translate button & comments
            │   ├── my-posts/             # With "My Posts" and "Commented" tabs
            │   ├── public-feed/          # Public posts discovery
            │   ├── settings/             # Profile settings + language + account deletion
            │   ├── user-profile/         # View profiles + personal posts
            │   ├── hashtags/             # Trending hashtags
            │   └── admin/                # Admin dashboard
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
