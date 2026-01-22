# SafeSpace - Social Network mit KI-gestützter Moderation

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.io/)

SafeSpace ist ein datenschutzfreundliches Social Network mit KI-gestützter Content-Moderation durch DeepSeek. Das Projekt kombiniert eine skalierbare Microservice-Architektur mit einem mehrstufigen Moderationssystem.

## Inhaltsverzeichnis

- [Features](#features)
- [Architektur](#architektur)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Konfiguration](#konfiguration)
- [API Dokumentation](#api-dokumentation)
- [Admin & Moderation](#admin--moderation)
- [Sichtbarkeits-System](#sichtbarkeits-system)
- [SafeSpace Moderation Pipeline](#safespace-moderation-pipeline)
- [Known Bugs & Limitations](#known-bugs--limitations)
- [Entwicklung](#entwicklung)
- [Lizenz](#lizenz)

---

## Features

### Kernfunktionen
- **Benutzerregistrierung & JWT-Authentifizierung** - Sichere Anmeldung mit Token-basierter Auth
- **Feed mit Auto-Refresh** - Posts von Freunden werden alle 30 Sekunden aktualisiert
- **Posts erstellen, bearbeiten, löschen** - Vollständige CRUD-Operationen
- **Kommentare & Likes** - Interaktion mit Posts
- **Media-Upload** - Bilder und Videos mit automatischer Thumbnail-Generierung
- **Freundschaftssystem** - Mit Beziehungstypen (Familie, Enge Freunde, Bekannte)

### Moderation & Sicherheit
- **KI-gestützte Hassrede-Erkennung** - Automatische Analyse durch DeepSeek
- **Live-Check beim Tippen** - Warnung vor dem Posten problematischer Inhalte
- **Verbesserungsvorschläge** - KI schlägt alternative Formulierungen vor
- **User-Meldungen** - Community kann unangemessene Posts melden
- **Admin Dashboard** - Übersicht für Moderatoren mit Quick-Actions
- **Mehrstufiges Rollen-System** - User, Moderator, Admin

### Sichtbarkeit & Privatsphäre
- 🌍 **Öffentlich** - Jeder kann den Post sehen
- 👋 **Bekannte** - Nur Bekannte und höher
- 💚 **Enge Freunde** - Nur enge Freunde und Familie
- 👨‍👩‍👧 **Familie** - Nur Familienmitglieder
- 🔒 **Privat** - Nur der Autor selbst

---

## Architektur

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

### Datenbank-Struktur

| Speicher | Verwendung |
|----------|------------|
| **PostgreSQL** | Users, Friendships, Reports, Moderation-Log, Rollen |
| **SQLite (pro User)** | Posts des jeweiligen Users (`/data/users/{uid}/posts.db`) |
| **Redis** | Feed-Cache mit 30s TTL |
| **MinIO** | Media-Dateien und SafeSpace-Reports (JSON) |
| **Kafka** | Message Queue für asynchrone Moderation |

---

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| **Backend** | FastAPI, Python 3.11+, psycopg3, aiosqlite, aiokafka |
| **Frontend** | Angular 18, Standalone Components, Signals, RxJS |
| **Datenbanken** | PostgreSQL 16, SQLite, Redis 7 |
| **Storage** | MinIO (S3-kompatibel) |
| **Queue** | Apache Kafka + Zookeeper |
| **KI** | DeepSeek API |
| **Container** | Docker, Docker Compose |

---

## Quick Start

### Voraussetzungen

- Docker & Docker Compose
- DeepSeek API Key (für KI-Moderation)

### Installation

```bash
# 1. Repository klonen
git clone https://github.com/YOUR_USERNAME/safespace.git
cd safespace

# 2. Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeite .env und trage deinen DEEPSEEK_API_KEY ein

# 3. Services starten
docker-compose up -d

# 4. Logs prüfen
docker-compose logs -f backend
```

### Zugriff

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Admin Dashboard | http://localhost:4200/admin |
| Kafka UI | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

### Admin-User anlegen

```bash
# Admin erstellen
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-admin admin admin@example.com sicheresPasswort123

# Moderator erstellen
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-moderator mod1 mod1@example.com passwort123

# Existierenden User befördern
docker exec -it socialnet-backend python -m app.cli.manage_users \
  promote username moderator
```

---

## Konfiguration

### Umgebungsvariablen (.env)

```env
# PostgreSQL
POSTGRES_PASSWORD=changeme
POSTGRES_DB=socialnet
POSTGRES_USER=socialnet

# JWT Secret (generieren mit: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here

# DeepSeek API (ERFORDERLICH für KI-Moderation)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Optional: Worker-Anzahl für Production
WORKERS=4
```

### Multi-Core Optimierung (Production)

Das Backend nutzt standardmäßig Uvicorn. Für Production mit Gunicorn:

```yaml
# docker-compose.yml
backend:
  command: gunicorn app.main:app -c gunicorn.conf.py
  environment:
    - WORKERS=8  # Anzahl CPU-Kerne
```

---

## API Dokumentation

### Authentifizierung

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/auth/register` | POST | Neuen User registrieren |
| `/api/auth/login` | POST | Login, gibt JWT zurück |
| `/api/auth/me` | GET | Aktuellen User abrufen |

### Feed & Posts

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/feed` | GET | Feed laden (gecached) |
| `/api/posts` | POST | Neuen Post erstellen |
| `/api/posts/{id}` | DELETE | Eigenen Post löschen |
| `/api/posts/{id}/like` | POST | Post liken |
| `/api/posts/{id}/comments` | POST | Kommentar hinzufügen |

### SafeSpace Moderation

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/safespace/check` | POST | Content vor dem Posten prüfen |
| `/api/safespace/suggest-revision` | POST | Verbesserungsvorschlag generieren |
| `/api/safespace/stats/user/{uid}` | GET | User Moderations-Statistiken |

### Admin (nur Moderator/Admin)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/admin/dashboard` | GET | Dashboard-Statistiken |
| `/api/admin/reports` | GET | Offene Reports auflisten |
| `/api/admin/reports/{id}/assign` | POST | Report übernehmen |
| `/api/admin/reports/{id}/resolve` | POST | Report abschließen |
| `/api/admin/users/{uid}/suspend` | POST | User sperren |
| `/api/admin/users/{uid}/role` | POST | Rolle ändern (nur Admin) |

---

## Admin & Moderation

### Rollen-System

| Rolle | Rechte |
|-------|--------|
| **user** | Standard-Nutzer, kann posten und melden |
| **moderator** | Reports bearbeiten, Posts löschen, User sperren |
| **admin** | Alles + Rollen vergeben |

### Moderator-Workflow

1. **Report eingeht** - User meldet Post über ⋮-Menü
2. **Übernehmen** - Moderator weist sich Report zu
3. **Review** - Post und KI-Analyse prüfen
4. **Aktion** - OK / Löschen / User sperren / Abweisen

### Report-Kategorien

- `hate_speech` - Hassrede
- `harassment` - Belästigung
- `spam` - Spam
- `inappropriate` - Unangemessener Inhalt
- `other` - Sonstiges

---

## Sichtbarkeits-System

Posts können mit verschiedenen Sichtbarkeitsstufen erstellt werden:

| Level | Wer sieht's | Beziehungstypen |
|-------|-------------|-----------------|
| `public` | Alle | - |
| `acquaintance` | Bekannte + höher | acquaintance, close_friend, family |
| `close_friend` | Enge Freunde + höher | close_friend, family |
| `family` | Nur Familie | family |
| `private` | Nur Autor | - |

### Beziehungstypen für Freunde

Beim Hinzufügen von Freunden kann der Beziehungstyp gewählt werden:
- **Familie** (`family`)
- **Enge Freunde** (`close_friend`)
- **Bekannte** (`acquaintance`)

---

## SafeSpace Moderation Pipeline

### Ablauf

```
User tippt Post
       │
       ▼
┌──────────────────┐
│ Live-Check       │ ← Debounced nach 1s Pause
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
│ DeepSeek API     │────▶│ Warnung anzeigen │
│ Analyse          │     │ + Vorschlag      │
└──────────────────┘     └──────────────────┘
       │
       ▼
User postet (oder korrigiert)
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

### Hassrede-Kategorien

| Kategorie | Beschreibung |
|-----------|--------------|
| 🔴 `racism` | Rassismus |
| 🔴 `sexism` | Sexismus |
| 🔴 `homophobia` | Homophobie |
| 🔴 `religious_hate` | Religiöse Hetze |
| 🔴 `xenophobia` | Fremdenfeindlichkeit |
| 🔴 `threat` | Drohungen |
| 🔴 `harassment` | Belästigung |

### Automatische Aktionen

| Score | Status | Aktion |
|-------|--------|--------|
| < 0.7 | ✅ approved | Post bleibt sichtbar |
| 0.7 - 0.9 | ⚠️ flagged | Markiert für Review |
| > 0.9 | 🚫 blocked | Automatisch blockiert |

---

## Known Bugs & Limitations

### 🔴 Kritische Bugs

| Bug | Beschreibung | Workaround |
|-----|--------------|------------|
| **401 nach Registration** | Nach der Registration wird kein automatischer Login durchgeführt. User erhält 401 beim Feed-Zugriff. | Manuell unter `/login` einloggen ODER die aktualisierte `register.component.ts` mit Auto-Login verwenden. |
| **Kafka Cluster ID Mismatch** | Nach Container-Neustarts können Kafka und Zookeeper unterschiedliche Cluster-IDs haben. | `docker volume rm socialnet_kafka_data && docker-compose up -d` |

### 🟡 Bekannte Einschränkungen

| Einschränkung | Beschreibung | Status |
|---------------|--------------|--------|
| **WebSocket HMR Fehler** | Development-Server zeigt WebSocket-Fehler für Hot Module Replacement. | Kein funktionaler Bug, nur Dev-Mode betroffen. |
| **Proxy-Konfiguration** | Frontend-Proxy muss auf `http://backend:8000` (nicht `localhost`) zeigen. | In `proxy.conf.json` prüfen. |
| **SQLite Skalierung** | Bei sehr vielen Freunden (>1000) kann Feed-Aggregation langsam werden. | Redis-Caching ist aktiv, aber für große Netzwerke evtl. Pagination nötig. |
| **DeepSeek Rate Limits** | API hat Rate Limits, bei hohem Traffic können Moderations-Checks verzögert werden. | Queue-basierte Verarbeitung puffert automatisch. |

### 🟢 Behobene Bugs (Historie)

| Bug | Lösung |
|-----|--------|
| bcrypt/passlib Crash | Backend Dockerfile verwendet jetzt `bcrypt==4.0.1` mit korrektem Build. |
| Feed Cache nicht invalidiert | Nach Post-Erstellung wird jetzt `FeedService.invalidate_feed()` aufgerufen. |
| CORS-Fehler | Backend hat vollständige CORS-Middleware mit korrekten Origins. |

---

## Entwicklung

### Projektstruktur

```
safespace/
├── docker-compose.yml          # Service-Orchestrierung
├── .env.example                # Umgebungsvariablen-Template
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI App
│       ├── api/                # API Router
│       │   ├── auth.py
│       │   ├── feed.py
│       │   ├── friends.py
│       │   ├── media.py
│       │   └── admin.py
│       ├── db/                 # Datenbank-Handler
│       │   ├── postgres.py
│       │   ├── sqlite.py
│       │   └── moderation.py
│       ├── cache/
│       │   └── redis_cache.py
│       ├── services/
│       │   ├── feed_service.py
│       │   └── auth_service.py
│       ├── safespace/          # KI-Moderation
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

### Lokale Entwicklung

```bash
# Backend separat starten (mit Hot-Reload)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend separat starten
cd frontend
npm install
ng serve --proxy-config proxy.conf.json
```

### Tests ausführen

```bash
# Backend Tests
docker exec -it socialnet-backend pytest

# Auth-Flow testen
./test-auth-flow-detailed.sh
```

---

## Lizenz

Dieses Projekt ist lizenziert unter der **GNU Affero General Public License v3.0** (AGPL-3.0).

Das bedeutet:
- ✅ Du darfst den Code verwenden, modifizieren und verteilen
- ✅ Du darfst den Code kommerziell nutzen
- ⚠️ Modifikationen müssen unter AGPL veröffentlicht werden
- ⚠️ Bei Bereitstellung als Webservice muss Quellcode verfügbar sein

Siehe [LICENSE](LICENSE) für den vollständigen Lizenztext.

---

## Contributing

Pull Requests sind willkommen! Bitte:

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committe deine Änderungen (`git commit -m 'Add AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

---

## Kontakt & Support

Bei Fragen oder Problemen:
- GitHub Issues öffnen
- Dokumentation in `/docs` prüfen
- API Docs unter http://localhost:8000/docs

---

*Built with ❤️ and AI-powered moderation*
