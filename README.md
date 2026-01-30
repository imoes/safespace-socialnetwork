# SafeSpace - Social Network with AI-Powered Moderation

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.io/)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org/)

SafeSpace is a privacy-focused social network with AI-powered content moderation using DeepSeek. The project combines a scalable microservice architecture with a multi-tiered moderation system, 27-language internationalization, and granular visibility controls.

**Live:** [thesafespace.blog](https://thesafespace.blog)

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Admin & Moderation](#admin--moderation)
- [Visibility System](#visibility-system)
- [Multi-Language Support](#multi-language-support-i18n)
- [SafeSpace Moderation Pipeline](#safespace-moderation-pipeline)
- [Known Bugs & Limitations](#known-bugs--limitations)
- [Development](#development)
- [License](#license)

---

## Features

### Core Features
- **User Registration & JWT Authentication** - Secure login with token-based auth and multilingual error messages
- **Password Reset** - Email-based password reset with secure tokens
- **Feed with Auto-Refresh** - Posts from friends are updated every 30 seconds (25 posts per page)
- **Create, Edit, Delete Posts** - Full CRUD operations with visibility control
- **Personal Wall Posts** - Write posts on friends' profiles (friends-only restriction)
- **Comments & Likes** - Interact with posts and like individual comments with Guardian AI moderation
- **Media Upload** - Images and videos with multipart/form-data support
- **Video Editor** - In-browser video editing with FFmpeg integration
- **Profile Pictures** - Upload and display custom profile pictures (max 10MB)
- **Enhanced User Search** - Real-time search by username or email with profile pictures and friends-first sorting
- **User Profiles** - View profiles with bio, name, role, birthday, and friend request option
- **Friendship System** - With relationship types (Family, Close Friends, Acquaintances)
- **Unfriend Functionality** - Remove friendships with confirmation dialog
- **Groups** - Create and manage groups with posts, membership, and role management
- **Notifications** - Real-time notifications for friend requests, post interactions, and birthday reminders
- **Hashtag System** - Automatic extraction, trending hashtags, and clickable hashtags in posts
- **Public Posts Feed** - Discover community posts with 25 posts per page pagination
- **My Posts with Tabs** - View your own posts and posts you've commented on
- **Post Translation** - Translate posts using Google Translate API (18 languages supported)
- **Link Preview** - Automatic URL preview generation for shared links
- **Dynamic Multi-Language UI** - 27 languages with filesystem-based language loading and RTL support
- **Account Deletion** - Permanently delete account with all data (posts, media, friendships)
- **OpenSearch Integration** - Full-text search for public posts with hashtag aggregations
- **SEO Optimization** - Dynamic meta tags and page titles for search engine visibility
- **Screen Time Tracking** - Usage tracking with reminder modal
- **Cookie Consent** - GDPR-compliant cookie consent management
- **Legal Pages** - Terms of Service, Privacy Policy, and Impressum

### Moderation & Safety
- **Guardian AI Moderation System** - Educational approach with modal for posts AND comments
  - Explanation of why content was flagged
  - 2 clickable alternative formulations with auto-submit
  - Custom text field for user's own revision
  - Dispute button to appeal to human moderator
  - AI disclaimer warning about potential errors
  - Double-click prevention for alternative submissions
- **SimpleModerator Fallback** - Keyword-based moderation when DeepSeek API unavailable (402 error)
- **Alternative Suggestions** - AI provides multiple ways to rephrase problematic content
- **Check on Submit** - Moderation check only when clicking "Post" button (reduces API traffic)
- **User Reports** - Community can report inappropriate posts with categories
- **Moderation Disputes** - Users can dispute AI decisions for human review
- **Admin Dashboard** - Overview for moderators with quick actions and system status monitoring
- **DeepSeek API Balance Monitoring** - Real-time display of remaining API credits with email alerts to admins when balance is low
- **User Management** - Admin panel with user search (by username, email, UID), role management, and ban controls
- **Multi-Tier Role System** - User, Moderator, Admin
- **System Status Page** - Real-time server monitoring with auto-refresh (CPU, RAM, Disk, user stats)
- **Welcome Messages** - Configurable welcome messages for new users
- **Broadcast Posts** - Admin-created announcements visible to all users

### Visibility & Privacy
- **Public** - Everyone can see the post
- **Acquaintances** - Only acquaintances and above
- **Close Friends** - Only close friends and family
- **Family** - Only family members
- **Private** - Only the author

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Nginx Reverse Proxy                              │
│            (SSL/TLS via Let's Encrypt + Certbot)                         │
│         thesafespace.blog / www.thesafespace.blog                        │
└─────────────────────────────────────────────────────────────────────────┘
                     │                          │
                     ▼                          ▼
┌──────────────────────────────┐  ┌──────────────────────────────────────┐
│      Angular Frontend        │  │           FastAPI Backend              │
│   (Auto-Refresh 30s + i18n)  │  │            /api/* Routes              │
└──────────────────────────────┘  └──────────────────────────────────────┘
                                  ├───────────┬────────────┬─────────────┤
                                  │ Auth API  │ Feed API   │ Friends API │
                                  │ Users API │ Groups API │ Admin API   │
                                  │ Media API │ SafeSpace  │ Hashtags    │
                                  │ Notif. API│ Translate  │ Reports     │
                                  └───────────┴────────────┴─────────────┘
                                        │          │            │
                                        ▼          ▼            ▼
                                  ┌──────────┐┌─────────┐┌──────────┐
                                  │PostgreSQL││  Redis  ││  SQLite  │
                                  │ (Users)  ││ (Cache) ││ (Posts)  │
                                  └──────────┘└─────────┘└──────────┘
                                  ┌──────────┐┌──────────┐┌────────────┐
                                  │  MinIO   ││  Kafka   ││ OpenSearch │
                                  │ (Media)  ││ (Queue)  ││  (Search)  │
                                  └──────────┘└──────────┘└────────────┘
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
| **PostgreSQL** | Users (profiles, birthday, language preference), Friendships, Reports, Moderation Log, Roles, Groups, Notifications, Password Reset Tokens, Welcome Messages, Site Settings, Email Templates |
| **SQLite (per User)** | Posts of the respective user with comment likes (`/data/users/{uid}/posts.db`) |
| **SQLite (per Group)** | Group posts and interactions |
| **Redis** | Feed cache with 30s TTL, session data |
| **MinIO** | Media files (images/videos) and SafeSpace reports (JSON) |
| **Kafka** | Message queue for asynchronous moderation |
| **OpenSearch** | Full-text search index for public posts with hashtag extraction and aggregation |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.12, psycopg3, aiosqlite, aiokafka, opensearch-py |
| **Frontend** | Angular 18, Standalone Components, Signals, RxJS, FFmpeg |
| **Databases** | PostgreSQL 16, SQLite, Redis 7 |
| **Search** | OpenSearch 2.11 |
| **Storage** | MinIO (S3-compatible) |
| **Queue** | Apache Kafka + Zookeeper |
| **AI** | DeepSeek API (OpenAI-compatible) |
| **Reverse Proxy** | Nginx with SSL/TLS |
| **SSL** | Let's Encrypt via Certbot (auto-renewal) |
| **Container** | Docker, Docker Compose |
| **Email** | SMTP (Gmail, Outlook, SendGrid, Mailgun) |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- DeepSeek API Key (for AI moderation)
- Domain name (for SSL/production) or localhost (for development)

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
| **Groups** | http://localhost:4200/groups |
| OpenSearch | http://localhost:9200 |
| Kafka UI | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

### Production Access (with Nginx)

| Service | URL |
|---------|-----|
| **Website** | https://thesafespace.blog |
| **API** | https://thesafespace.blog/api |
| **Mail Server** | mail.thesafespace.blog |

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

# Email (optional)
SAFESPACE_EMAIL_ENABLED=false
SAFESPACE_SMTP_HOST=smtp.gmail.com
SAFESPACE_SMTP_PORT=587
SAFESPACE_SMTP_USER=your-email@gmail.com
SAFESPACE_SMTP_PASSWORD=your-app-password

# Optional: Worker count for production
WORKERS=4
```

### Nginx & SSL Configuration

The project includes a pre-configured Nginx reverse proxy for production:

- **HTTP to HTTPS redirect** for all traffic
- **Multi-domain support**: `thesafespace.blog`, `www.thesafespace.blog`
- **API proxying**: `/api/*` routes to FastAPI backend
- **Mail server proxy**: `mail.thesafespace.blog` proxies to LAN mail server
- **Stream proxy**: SMTP (25), Submission (587), IMAPS (993)
- **SSL certificates**: Auto-managed by Certbot with Let's Encrypt
- **Client max body size**: 100MB (for media uploads)

Configuration files:
- `nginx/nginx.conf` - Main Nginx configuration
- `nginx/conf.d/` - Server block configurations
- `nginx/stream.d/` - TCP stream proxying (mail)
- `nginx/init-ssl.sh` - SSL initialization script

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

### Password Reset

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/password-reset/request` | POST | Request password reset email |
| `/api/password-reset/reset` | POST | Reset password with token |

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
| `/api/users/search?q={query}` | GET | Search users by username or email (min 2 chars, friends-first sorting) |
| `/api/users/list` | GET | Admin: list all users with stats and email |
| `/api/users/{uid}` | GET | Get user profile (username, bio, role, name, profile picture, is_friend) |
| `/api/users/{uid}/posts` | GET | Get user's posts (visibility-aware, 25 per page) |
| `/api/users/{uid}/posts` | POST | Create personal post on friend's profile (friends only) |
| `/api/users/me` | PUT | Update own profile (email, bio, first_name, last_name, password) |
| `/api/users/me/profile-picture` | POST | Upload profile picture (max 10MB, images only) |
| `/api/users/me/posts` | GET | Get own posts (all visibility levels, 25 per page) |
| `/api/users/me/commented-posts` | GET | Get posts where user has commented (25 per page) |
| `/api/users/me/account` | DELETE | Permanently delete account with all data |

### Friends

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/friends` | GET | List all friends |
| `/api/friends/family` | GET | Filter by family |
| `/api/friends/close` | GET | Filter by close friends |
| `/api/friends/acquaintances` | GET | Filter by acquaintances |
| `/api/friends/{uid}/request` | POST | Send friend request |
| `/api/friends/{uid}/accept` | POST | Accept friend request |
| `/api/friends/{uid}` | DELETE | Remove friend |

### Groups

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/groups` | POST | Create a group |
| `/api/groups` | GET | List user's groups |
| `/api/groups/{id}` | GET | Get group details |
| `/api/groups/{id}/posts` | POST | Post in a group |
| `/api/groups/{id}/posts` | GET | Get group posts |
| `/api/groups/{id}/join` | POST | Join a group |
| `/api/groups/{id}/members/{uid}/role` | POST | Set member role |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get user notifications |
| `/api/notifications/{id}/read` | POST | Mark notification as read |
| `/api/notifications/unread-count` | GET | Get unread notification count |

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

### Link Preview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/link-preview` | POST | Get URL preview (title, description, image) |

### Welcome & Broadcast

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/welcome` | GET | Get welcome message for new users |
| `/api/broadcast` | GET | Get broadcast posts |

### Admin (Moderator/Admin only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/dashboard` | GET | Dashboard statistics |
| `/api/admin/system-status` | GET | System performance, user stats, and health monitoring |
| `/api/admin/deepseek-balance` | GET | DeepSeek API balance and credit info |
| `/api/admin/reports` | GET | List open reports |
| `/api/admin/reports/{id}/assign` | POST | Claim report |
| `/api/admin/reports/{id}/resolve` | POST | Resolve report |
| `/api/admin/users/{uid}/suspend` | POST | Suspend user |
| `/api/admin/users/{uid}/unsuspend` | POST | Unsuspend user |
| `/api/admin/users/{uid}/role` | POST | Change role (Admin only) |
| `/api/admin/welcome-message` | GET/PUT/DELETE | Manage welcome message (Admin only) |
| `/api/admin/broadcast-post` | POST | Create broadcast post (Admin only) |
| `/api/admin/broadcast-posts` | GET | List broadcast posts (Admin only) |
| `/api/admin/site-settings` | GET/PUT | Manage site settings |

### Health Check

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Backend health check |
| `/api/site-settings/title` | GET | Public site title |

---

## Admin & Moderation

### Role System

| Role | Permissions |
|------|-------------|
| **user** | Standard user, can post and report |
| **moderator** | Process reports, delete posts, suspend users, view system status |
| **admin** | Everything + assign roles, manage site settings, view DeepSeek balance, user management |

### Admin Dashboard Features

- **System Status** - Real-time CPU, RAM, Disk usage monitoring with auto-refresh
- **DeepSeek API Balance** - Live display of remaining API credits (USD), with warning states and email alerts to all admins when balance drops below $1.00
- **User Management** - Search users by username, email, or UID; view user statistics; manage roles and bans
- **Moderation Log** - Review flagged content and moderation history
- **Reports Queue** - Process user reports with claim/resolve workflow
- **Welcome Messages** - Configure welcome messages for new users
- **Broadcast Posts** - Create admin announcements

### Moderator Workflow

1. **Report Received** - User reports post via menu
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

SafeSpace supports **27 languages** with automatic browser detection and user preferences:

### Supported Languages

| Language | Code | Native Name |
|----------|------|-------------|
| English | `en` | English |
| German | `de` | Deutsch |
| French | `fr` | Français |
| Spanish | `es` | Español |
| Italian | `it` | Italiano |
| Portuguese | `pt` | Português |
| Dutch | `nl` | Nederlands |
| Danish | `da` | Dansk |
| Swedish | `sv` | Svenska |
| Finnish | `fi` | Suomi |
| Polish | `pl` | Polski |
| Czech | `cs` | Čeština |
| Slovak | `sk` | Slovenčina |
| Slovenian | `sl` | Slovenščina |
| Croatian | `hr` | Hrvatski |
| Hungarian | `hu` | Magyar |
| Romanian | `ro` | Română |
| Bulgarian | `bg` | Български |
| Greek | `el` | Ελληνικά |
| Lithuanian | `lt` | Lietuvių |
| Latvian | `lv` | Latviešu |
| Estonian | `et` | Eesti |
| Irish | `ga` | Gaeilge |
| Maltese | `mt` | Malti |
| Arabic | `ar` | العربية (RTL) |
| Hindi | `hi` | हिन्दी |
| Chinese | `zh` | 中文 |

### Features

- **Browser Language Detection** - Automatically detects and sets user's browser language on first visit
- **User Preference** - Change language in Settings and save to localStorage
- **Dynamic Language Loading** - Languages are loaded from filesystem via `languages.json` manifest
- **Translation Files** - All translations in `/assets/i18n/{language}.json` for easy extension
- **Template Interpolation** - Support for parameters like `{{count}}` in translations
- **RTL Support** - Automatic HTML `dir="rtl"` for right-to-left languages (Arabic)
- **Dynamic HTML Attributes** - Sets `lang` attribute dynamically
- **Error Messages** - User-friendly multilingual error messages for registration and login
- **Complete Coverage** - All UI sections translated: navigation, feed, posts, comments, friends, groups, settings, admin panel, moderation, password reset, user management, video editor

### Adding New Languages

1. Create new translation file: `/frontend/src/assets/i18n/newlanguage.json`
2. Copy structure from `english.json`
3. Translate all keys (including `register.errors` and `login.errors`)
4. Add language entry to `/frontend/src/assets/i18n/languages.json` manifest:
   ```json
   {
     "code": "pt",
     "name": "Portuguese",
     "nativeName": "Português",
     "flag": "🇵🇹",
     "file": "portuguese"
   }
   ```
5. Language will automatically appear in Settings language selector

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

---

## OpenSearch Integration & Hashtags

### How It Works

**Automatic Indexing:**
- When a user creates a **public** post, it's automatically indexed in OpenSearch
- Hashtags are extracted using regex pattern `#(\w+)`
- Post metadata includes: author username, first_name, last_name, content, hashtags, timestamp
- Each indexed document gets a unique `opensearch_doc_id` stored in SQLite

**Visibility Changes:**
- Changing post from public to private: removes from OpenSearch index
- Changing post from private to public: adds to OpenSearch index

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
- Search by username or email with ILIKE pattern matching
- Friends-first sorting for relevant results
- Click result to view profile page
- Shows username, bio, and avatar

---

## SafeSpace Moderation Pipeline

### Guardian Moderation Flow

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

### Hate Speech Categories

| Category | Description |
|----------|-------------|
| `racism` | Racism |
| `sexism` | Sexism |
| `homophobia` | Homophobia |
| `religious_hate` | Religious hatred |
| `xenophobia` | Xenophobia |
| `threat` | Threats |
| `harassment` | Harassment |

### Automatic Actions

| Score | Status | Action |
|-------|--------|--------|
| < 0.7 | approved | Post remains visible |
| 0.7 - 0.9 | flagged | Marked for review |
| > 0.9 | blocked | Automatically blocked |

---

## Known Bugs & Limitations

### Known Limitations

| Limitation | Description | Status |
|------------|-------------|--------|
| **WebSocket HMR Error** | Development server shows WebSocket errors for Hot Module Replacement. | Not a functional bug, only affects dev mode. |
| **Proxy Configuration** | Frontend proxy must match deployment: `http://localhost:8000` (local) or `http://backend:8000` (Docker service name). | See [DOCKER-ENTWICKLUNG.md](DOCKER-ENTWICKLUNG.md) or [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md) for details. |
| **SQLite Scaling** | With many friends (>1000), feed aggregation may become slow. | Redis caching is active, but pagination may be needed for large networks. |
| **DeepSeek Rate Limits** | API has rate limits; moderation checks may be delayed under high traffic. | Queue-based processing buffers automatically. |
| **Kafka Cluster ID Mismatch** | After container restarts, Kafka and Zookeeper may have different cluster IDs. | `docker volume rm socialnet_kafka_data && docker-compose up -d` |

### Fixed Bugs (History)

| Bug | Solution |
|-----|----------|
| bcrypt/passlib Crash | Backend Dockerfile now uses `bcrypt==4.0.1` with correct build. |
| Feed Cache Not Invalidated | `FeedService.invalidate_feed()` is now called after post creation. |
| CORS Errors | Backend has complete CORS middleware with correct origins. |
| Image Upload 422 Error | Fixed `/api/feed/with-media` endpoint by adding `Form()` decorators for proper multipart/form-data handling. |
| DeepSeek API 402 Error | Implemented `SimpleModerator` fallback with keyword-based detection when API is unavailable. |
| Guardian Modal Spam | Changed from real-time checking to check-on-submit (only when clicking "Post" button) to reduce API traffic. |
| 401 Login Error | `proxy.conf.json` now points to `backend:8000` (Docker service name). |
| 401 after Registration | Updated `register.component.ts` with auto-login after registration. |
| Welcome Messages INSERT | Fixed missing `is_active` value in INSERT statement. |
| SEO Service TypeScript Error | Fixed NavigationEnd type casting in subscribe callback. |
| DeepSeek Balance Not Showing | Fixed auth token handling - removed manual headers, using auth interceptor. |
| Non-Friends Wall Posts | Added friendship check to `create_personal_post` endpoint (403 if not friends). |

---

## Development

> **Docker-Entwicklung?**
> Siehe [DOCKER-ENTWICKLUNG.md](DOCKER-ENTWICKLUNG.md) für detaillierte Anweisungen zur Entwicklung mit Docker Compose, inkl. Problemlösung für 401-Login-Fehler.
>
> **Lokale Entwicklung ohne Docker?**
> Siehe [LOKALE-ENTWICKLUNG.md](LOKALE-ENTWICKLUNG.md) für Anweisungen zum Starten des Backends und Frontends direkt auf Ihrem System.

### Project Structure

```
safespace/
├── docker-compose.yml          # Service orchestration (11 containers)
├── .env.example                # Environment variables template
│
├── nginx/                      # Reverse proxy
│   ├── nginx.conf              # Main Nginx configuration
│   ├── conf.d/                 # Server block configurations
│   ├── stream.d/               # TCP stream proxying (mail)
│   └── init-ssl.sh             # SSL initialization script
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── gunicorn.conf.py        # Production server config
│   └── app/
│       ├── main.py             # FastAPI App
│       ├── api/                # API Routers (17 modules)
│       │   ├── auth.py         # Authentication & JWT
│       │   ├── feed.py         # Feed aggregation
│       │   ├── friends.py      # Friendship management
│       │   ├── groups.py       # Group management
│       │   ├── media.py        # Media upload
│       │   ├── admin.py        # Admin dashboard & DeepSeek balance
│       │   ├── users.py        # User search (username + email), profiles, settings
│       │   ├── hashtags.py     # Hashtag trending & search
│       │   ├── translation.py  # Post translation API
│       │   ├── public_feed.py  # Public posts feed
│       │   ├── reports.py      # User reporting system
│       │   ├── notifications.py # Notification system
│       │   ├── password_reset.py # Password reset flow
│       │   ├── broadcast.py    # Broadcast posts
│       │   ├── welcome.py      # Welcome messages
│       │   └── link_preview.py # URL preview generation
│       ├── db/                 # Database handlers (11 modules)
│       │   ├── postgres.py     # PostgreSQL: users, friendships, groups
│       │   ├── sqlite_posts.py # Per-user SQLite posts + comments
│       │   ├── sqlite_group_posts.py # Group post storage
│       │   ├── moderation.py   # Moderation log & roles
│       │   ├── notifications.py # Notification storage
│       │   ├── broadcast_posts.py # Broadcast messages
│       │   ├── welcome_message.py # Welcome message handling
│       │   ├── site_settings.py # Site configuration
│       │   ├── schema_extensions.py # Additional schemas
│       │   ├── email_templates.py # Email templates
│       │   └── password_reset.py # Password reset tokens (SQLite)
│       ├── cache/
│       │   └── redis_cache.py
│       ├── services/           # Business logic (8 services)
│       │   ├── feed_service.py
│       │   ├── auth_service.py
│       │   ├── media_service.py
│       │   ├── opensearch_service.py  # OpenSearch integration
│       │   ├── translation_service.py # Google Translate integration
│       │   ├── email_service.py       # SMTP email notifications
│       │   └── birthday_service.py    # Birthday reminder scheduler
│       ├── safespace/          # AI Moderation
│       │   ├── config.py       # DeepSeek API config
│       │   ├── models.py
│       │   ├── kafka_service.py
│       │   ├── minio_service.py
│       │   ├── deepseek_moderator.py
│       │   ├── simple_moderator.py    # Fallback moderator
│       │   ├── worker.py
│       │   └── api.py
│       └── cli/
│           └── manage_users.py # Admin/moderator user creation
│
├── frontend/
│   ├── Dockerfile.dev
│   ├── proxy.conf.json         # API proxy (local dev)
│   ├── proxy.conf.docker.json  # API proxy (Docker)
│   └── src/
│       ├── assets/i18n/        # Translation files (27 languages)
│       │   ├── languages.json  # Language manifest
│       │   ├── english.json
│       │   ├── german.json
│       │   ├── french.json
│       │   ├── spanish.json
│       │   ├── italian.json
│       │   ├── portuguese.json
│       │   ├── dutch.json
│       │   ├── ... (20 more languages)
│       │   └── chinese.json
│       └── app/
│           ├── services/       # Angular services (17)
│           │   ├── auth.service.ts
│           │   ├── feed.service.ts
│           │   ├── user.service.ts       # User search & profiles
│           │   ├── friends.service.ts    # Friendship management
│           │   ├── groups.service.ts     # Group management
│           │   ├── notifications.service.ts # Notifications
│           │   ├── hashtag.service.ts    # Hashtag trending & search
│           │   ├── translation.service.ts # Post translation
│           │   ├── i18n.service.ts       # Multi-language support
│           │   ├── safespace.service.ts  # Moderation API
│           │   ├── report.service.ts     # User reporting
│           │   ├── admin.service.ts      # Admin operations
│           │   ├── link-preview.service.ts # URL preview
│           │   ├── screen-time.service.ts # Usage tracking
│           │   ├── emoji.service.ts      # Emoji support
│           │   └── seo.service.ts        # SEO optimization
│           ├── components/     # Angular components (26)
│           │   ├── feed/               # Friend's feed
│           │   ├── login/              # Login form
│           │   ├── register/           # Registration form
│           │   ├── forgot-password/    # Password reset request
│           │   ├── reset-password/     # Password reset form
│           │   ├── create-post/        # Post creation with Guardian modal
│           │   ├── post-card/          # Post display with translate & comments
│           │   ├── my-posts/           # "My Posts" and "Commented" tabs
│           │   ├── public-feed/        # Public posts discovery
│           │   ├── settings/           # Profile settings + language + account deletion
│           │   ├── user-profile/       # View profiles + personal wall posts
│           │   ├── friends/            # Friend management and lists
│           │   ├── groups/             # Group management
│           │   ├── hashtags/           # Trending hashtags
│           │   ├── notifications-dropdown/ # Notification dropdown
│           │   ├── admin/              # Admin features
│           │   ├── admin-panel/        # Admin dashboard with DeepSeek balance
│           │   ├── user-management/    # User search & management
│           │   ├── video-editor/       # Video editing with FFmpeg
│           │   ├── welcome-modal/      # Welcome for new users
│           │   ├── screen-time-modal/  # Screen time tracking
│           │   ├── cookie-consent/     # GDPR cookie notice
│           │   ├── terms-of-service/   # ToS page
│           │   ├── privacy-policy/     # Privacy policy page
│           │   ├── impressum/          # Legal imprint
│           │   └── info/               # Information/help
│           ├── guards/
│           │   └── auth.guard.ts
│           └── interceptors/
│               └── auth.interceptor.ts # Auto JWT header injection
│
├── docs/
│   ├── DSGVO.md                # GDPR compliance documentation
│   └── EMAIL_SETUP.md          # Email configuration guide
│
└── tests/
    ├── test_backend_api.py     # Backend API tests (20+)
    └── test_e2e_playwright.py  # End-to-End tests (12+)
```

### Docker Services (11 Containers)

| Container | Image | Purpose |
|-----------|-------|---------|
| `socialnet-frontend` | Angular 18 | Web application |
| `socialnet-backend` | FastAPI/Python | API server |
| `socialnet-worker` | Python | Async moderation worker |
| `socialnet-postgres` | PostgreSQL 16 | User database |
| `socialnet-redis` | Redis 7 | Cache layer |
| `socialnet-opensearch` | OpenSearch 2.11 | Full-text search |
| `socialnet-kafka` | Kafka 7.5 | Message queue |
| `socialnet-zookeeper` | Zookeeper 7.5 | Kafka coordination |
| `socialnet-minio` | MinIO | Object storage |
| `socialnet-nginx` | Nginx Alpine | Reverse proxy + SSL |
| `socialnet-certbot` | Certbot | SSL certificate management |

### Data Persistence

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `postgres_data` | `/mnt/data/postgres_data` | User database |
| `minio_data` | `/mnt/data/minio_data` | Media files |
| `opensearch_data` | `/mnt/data/opensearch_data` | Search index |
| `user_data` | `/mnt/data/backend/user_data` | SQLite post databases |
| `certbot_certs` | `/mnt/data/certbot_certs` | SSL certificates |

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

SafeSpace includes comprehensive test suites for both backend and frontend:

#### Backend API Tests

```bash
# Run all backend tests (20+ tests covering authentication, posts, comments, notifications, etc.)
cd /home/user/safespace-socialnetwork
python -m pytest tests/test_backend_api.py -v

# View test logs
cat logs/backend_api_test_*.log
```

**Tests include:**
- Authentication (Register, Login, Token validation)
- Posts (Create, Read, Update, Delete, Like, Visibility)
- Comments (Create, Update, Delete, Like/Unlike)
- Notifications (Create, Mark read, Delete, Unread count)
- User Search (Query, Results format)
- Error handling (Duplicate username, Duplicate email)

#### End-to-End (E2E) Tests with Playwright

```bash
# Install Playwright
pip install playwright
playwright install

# Run E2E tests (12+ tests covering user flows)
python -m pytest tests/test_e2e_playwright.py -v

# View test logs and screenshots
cat logs/e2e_test_*.log
ls screenshots/
```

**Tests include:**
- User registration and login flows
- Duplicate username/email error messages
- Post creation and deletion
- Comment posting
- User search
- Notifications navigation

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

This means:
- You may use, modify, and distribute the code
- You may use the code commercially
- Modifications must be published under AGPL
- When providing as a web service, source code must be available

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

*Built with AI-powered moderation for a safer social experience*
