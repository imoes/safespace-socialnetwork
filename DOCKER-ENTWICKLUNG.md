# Docker-Entwicklung - SafeSpace Social Network

Diese Anleitung zeigt, wie Sie das SafeSpace-Projekt **mit Docker** entwickeln.

## Problemlösung: 401 Login-Fehler in Docker

**Symptom:** Login schlägt mit 401 Unauthorized fehl, obwohl Admin-User erstellt wurde.

**Ursache:** Die Proxy-Konfiguration muss auf den **Docker-Service-Namen** zeigen (`backend`), nicht auf `localhost`.

**Lösung:** ✅ Die `proxy.conf.json` ist jetzt auf `http://backend:8000` konfiguriert.

---

## Voraussetzungen

- **Docker** (Version 20.10+)
- **Docker Compose** (Version 2.0+)
- **DeepSeek API Key** (optional, für AI-Moderation)

```bash
# Versionen prüfen:
docker --version
docker compose version
```

---

## Quick Start

### 1. Environment-Variablen konfigurieren

```bash
# .env-Datei im Projekt-Root erstellen:
cat > .env <<EOF
# PostgreSQL
POSTGRES_PASSWORD=changeme

# JWT Secret (generieren mit: openssl rand -hex 32)
SECRET_KEY=$(openssl rand -hex 32)

# DeepSeek API (optional, für AI-Moderation)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
EOF
```

**Wichtig:** Ändern Sie die Passwörter für Produktionsumgebungen!

### 2. Services starten

```bash
# Alle Services starten:
docker compose up -d

# Logs verfolgen:
docker compose logs -f

# Nur bestimmte Services starten:
docker compose up -d postgres redis backend frontend
```

**Erste Start-Hinweise:**
- Erster Build kann 5-10 Minuten dauern
- PostgreSQL, Redis, Kafka und MinIO starten zuerst
- Backend wartet auf Health Checks der Dependencies
- Frontend startet zuletzt

### 3. Services prüfen

```bash
# Status aller Container:
docker compose ps

# Sollte zeigen:
# socialnet-postgres      running
# socialnet-redis         running
# socialnet-kafka         running
# socialnet-zookeeper     running
# socialnet-minio         running
# socialnet-backend       running
# socialnet-frontend      running
# socialnet-safespace-worker  running
```

### 4. Admin-User erstellen

```bash
# Admin erstellen:
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-admin admin admin@example.com IhrSicheresPasswort123

# Ausgabe sollte sein:
# ✅ Admin 'admin' erfolgreich erstellt!

# Moderator erstellen (optional):
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-moderator mod mod@example.com PasswortMod123
```

**Wichtig:** Notieren Sie sich Username und Passwort!

### 5. Anwendung öffnen

| Service | URL | Beschreibung |
|---------|-----|--------------|
| **Frontend** | http://localhost:4200 | Angular-Anwendung |
| **Backend API** | http://localhost:8000 | FastAPI |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **Kafka UI** | http://localhost:8080 | Kafka Management |
| **MinIO Console** | http://localhost:9001 | Object Storage (minioadmin/minioadmin) |

### 6. Login testen

1. Öffnen Sie http://localhost:4200
2. Navigieren Sie zu `/login`
3. Geben Sie die Admin-Credentials ein:
   - Username: `admin`
   - Passwort: `IhrSicheresPasswort123`
4. Bei Erfolg werden Sie zum Feed weitergeleitet

---

## Docker-Netzwerk und Proxy-Konfiguration

### Wichtig zu verstehen:

```
┌─────────────────────────────────────────────────────┐
│              Docker Network: default                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐  │
│  │   Frontend       │      │   Backend        │  │
│  │   Container      │─────▶│   Container      │  │
│  │   localhost:4200 │      │   backend:8000   │  │
│  └──────────────────┘      └──────────────────┘  │
│          │                          │              │
│          │ Proxy-Config             │              │
│          │ /api → backend:8000      │              │
│                                                     │
└─────────────────────────────────────────────────────┘
         │
         ▼
    Host-System
    localhost:4200 (Frontend)
    localhost:8000 (Backend)
```

**Wichtige Punkte:**

1. **Im Docker-Netzwerk:**
   - Services erreichen sich über **Service-Namen** (z.B. `backend`, `postgres`, `redis`)
   - `proxy.conf.json` muss auf `http://backend:8000` zeigen

2. **Vom Host-System:**
   - Services sind über `localhost` erreichbar (Port-Mapping)
   - Frontend: `http://localhost:4200`
   - Backend: `http://localhost:8000`

3. **Warum nicht `localhost` im Proxy?**
   - Der Frontend-Container läuft **innerhalb** des Docker-Netzwerks
   - `localhost` im Container würde auf den Container selbst zeigen, nicht auf den Host
   - Deshalb muss der **Service-Name** (`backend`) verwendet werden

---

## Entwicklung mit Hot-Reload

Das Docker-Setup unterstützt automatisches Neuladen bei Code-Änderungen:

### Backend (FastAPI)

```yaml
# docker-compose.yml - Backend-Service:
volumes:
  - ./backend/app:/app/app:ro  # Read-only mount für Hot-Reload
```

**Änderungen in `backend/app/*.py` werden automatisch erkannt!**

Sie können Logs in Echtzeit verfolgen:
```bash
docker compose logs -f backend
```

### Frontend (Angular)

```yaml
# docker-compose.yml - Frontend-Service:
volumes:
  - ./frontend:/app
  - /app/node_modules  # Verhindert Überschreiben
```

**Änderungen in `frontend/src/**/*` werden automatisch erkannt!**

Logs verfolgen:
```bash
docker compose logs -f frontend
```

---

## Häufige Aufgaben

### Container neustarten

```bash
# Einzelnen Service neustarten:
docker compose restart backend

# Alle Services neustarten:
docker compose restart

# Stoppen und neu starten (mit Rebuild):
docker compose down
docker compose up -d --build
```

### Logs anzeigen

```bash
# Alle Logs:
docker compose logs

# Logs eines Services:
docker compose logs backend

# Live-Logs verfolgen:
docker compose logs -f backend

# Letzte 100 Zeilen:
docker compose logs --tail=100 backend
```

### In Container einsteigen

```bash
# Backend-Container:
docker exec -it socialnet-backend bash

# Dann z.B. Python-Shell:
python
>>> from app.db.postgres import get_users
>>> # ...

# Oder direkt User-Management:
docker exec -it socialnet-backend python -m app.cli.manage_users --help
```

### Datenbanken verwalten

```bash
# PostgreSQL-Konsole:
docker exec -it socialnet-postgres psql -U socialnet -d socialnet

# SQL-Abfragen:
# SELECT * FROM users;
# SELECT * FROM friendships;

# Redis-Konsole:
docker exec -it socialnet-redis redis-cli

# Redis-Befehle:
# KEYS *
# GET feed:user:abc123
```

### Services einzeln stoppen/starten

```bash
# Nur Kafka und Worker stoppen (z.B. ohne AI-Moderation entwickeln):
docker compose stop kafka zookeeper safespace-worker

# Backend und Frontend behalten:
docker compose ps  # Prüfen welche Services noch laufen

# Einzelne Services wieder starten:
docker compose start kafka zookeeper safespace-worker
```

---

## Fehlerdiagnose

### 1. Backend startet nicht / Health Check schlägt fehl

**Symptom:**
```bash
docker compose ps
# Zeigt: socialnet-backend - unhealthy
```

**Lösung:**
```bash
# Logs prüfen:
docker compose logs backend

# Häufige Ursachen:
# - PostgreSQL nicht bereit → warten oder postgres restart
# - Kafka nicht bereit → docker compose restart kafka
# - Port 8000 bereits belegt → Port in docker-compose.yml ändern

# Health Check manuell testen:
docker exec -it socialnet-backend curl http://localhost:8000/health
```

### 2. Frontend kann Backend nicht erreichen (401 Fehler)

**Symptom:**
```
POST http://localhost:4200/api/auth/login 401 (Unauthorized)
```

**Ursachen und Lösungen:**

**A) Proxy-Konfiguration falsch**
```bash
# Prüfen Sie proxy.conf.json:
cat frontend/proxy.conf.json

# Sollte sein:
# "target": "http://backend:8000"
# NICHT "localhost:8000" oder "socialnet-backend:8000"
```

**B) Backend läuft nicht**
```bash
# Container-Status prüfen:
docker compose ps backend

# Wenn "exited" oder "unhealthy":
docker compose logs backend
docker compose restart backend
```

**C) Admin-User existiert nicht**
```bash
# User erstellen:
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-admin admin admin@example.com PasswortXYZ
```

**D) Falsches Passwort**
- Verwenden Sie das Passwort, das Sie bei `create-admin` angegeben haben
- Passwort ist case-sensitive

### 3. Kafka Cluster ID Mismatch

**Symptom:**
```
ERROR Kafka broker ID mismatch
```

**Lösung:**
```bash
# Kafka-Volumes löschen und neu erstellen:
docker compose down
docker volume rm safespace-socialnetwork_kafka_data safespace-socialnetwork_zookeeper_data
docker compose up -d
```

### 4. Port bereits belegt

**Symptom:**
```
Error: bind: address already in use
```

**Lösung:**
```bash
# Prüfen welcher Prozess den Port belegt:
# Linux/macOS:
lsof -i :4200
lsof -i :8000

# Windows:
netstat -ano | findstr :4200

# Prozess beenden oder Port in docker-compose.yml ändern:
# Beispiel: "4201:4200" statt "4200:4200"
```

### 5. Build-Fehler beim Backend

**Symptom:**
```
ERROR: failed to solve: process "/bin/sh -c pip install bcrypt" did not complete successfully
```

**Lösung:**
```bash
# Rebuild mit --no-cache:
docker compose build --no-cache backend

# Oder Docker-Cache komplett löschen:
docker builder prune -a
docker compose build backend
```

### 6. Frontend zeigt "Cannot GET /"

**Symptom:** Browser zeigt leere Seite oder 404

**Lösung:**
```bash
# Frontend-Logs prüfen:
docker compose logs frontend

# Häufige Ursachen:
# - npm install läuft noch (beim ersten Start)
# - node_modules nicht korrekt installiert

# Fix:
docker compose restart frontend
# Warten bis "Compiled successfully" in den Logs erscheint
```

---

## Performance-Optimierung

### 1. Multi-Core Backend (Produktion)

Standardmäßig läuft das Backend mit Uvicorn (1 Worker). Für Produktion:

```yaml
# docker-compose.yml - Backend-Service ändern:
backend:
  environment:
    - WORKERS=4  # Anzahl CPU-Cores
  command: gunicorn app.main:app -c gunicorn.conf.py
```

### 2. Build-Cache beschleunigen

```bash
# Docker BuildKit aktivieren (schnellerer Build):
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker compose build
```

### 3. Ressourcen-Limits

```yaml
# docker-compose.yml - Ressourcen begrenzen:
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        memory: 512M
```

---

## Produktions-Deployment

### 1. Umgebungsvariablen sichern

```bash
# Niemals Secrets in git commiten!
# .env sollte in .gitignore sein

# Sichere Secrets generieren:
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
MINIO_SECRET_KEY=$(openssl rand -base64 32)
```

### 2. HTTPS und Reverse Proxy

Für Produktion sollten Sie einen Reverse Proxy (nginx, Traefik, Caddy) verwenden:

```yaml
# Beispiel: nginx als Reverse Proxy hinzufügen
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - ./ssl:/etc/nginx/ssl
  depends_on:
    - frontend
    - backend
```

### 3. Production Frontend Build

Für Produktion sollte das Frontend gebaut werden:

```yaml
# Dockerfile.prod für Frontend erstellen
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --configuration production

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

## Daten-Backup

### PostgreSQL Backup

```bash
# Backup erstellen:
docker exec socialnet-postgres pg_dump -U socialnet socialnet > backup.sql

# Mit Timestamp:
docker exec socialnet-postgres pg_dump -U socialnet socialnet > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore:
docker exec -i socialnet-postgres psql -U socialnet -d socialnet < backup.sql
```

### Volumes sichern

```bash
# Alle Volumes listen:
docker volume ls | grep safespace

# Volume backup:
docker run --rm -v safespace-socialnetwork_user_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/user_data_backup.tar.gz /data
```

---

## Nützliche Befehle - Übersicht

```bash
# === Services starten/stoppen ===
docker compose up -d                    # Alle Services starten
docker compose down                     # Alle Services stoppen
docker compose restart backend          # Service neustarten
docker compose stop frontend            # Service stoppen
docker compose start frontend           # Service starten

# === Logs ===
docker compose logs -f                  # Alle Logs (live)
docker compose logs backend             # Backend-Logs
docker compose logs --tail=50 backend   # Letzte 50 Zeilen

# === Status ===
docker compose ps                       # Container-Status
docker compose top                      # Laufende Prozesse
docker stats                            # Ressourcen-Nutzung (live)

# === Container-Shell ===
docker exec -it socialnet-backend bash  # Backend-Shell
docker exec -it socialnet-frontend sh   # Frontend-Shell

# === Datenbank ===
docker exec -it socialnet-postgres psql -U socialnet -d socialnet
docker exec -it socialnet-redis redis-cli

# === User-Management ===
docker exec -it socialnet-backend python -m app.cli.manage_users create-admin <user> <email> <pass>
docker exec -it socialnet-backend python -m app.cli.manage_users promote <user> moderator

# === Cleanup ===
docker compose down -v                  # Mit Volumes löschen
docker system prune -a                  # Docker-Cache löschen
docker volume prune                     # Ungenutzte Volumes löschen

# === Rebuild ===
docker compose build --no-cache         # Build ohne Cache
docker compose up -d --build            # Build und starten
```

---

## Zusammenfassung - Docker-Workflow

### Erster Start:

1. ✅ `.env`-Datei mit Secrets erstellen
2. ✅ `docker compose up -d` ausführen
3. ✅ Warten bis alle Services "healthy" sind (ca. 2-5 Minuten)
4. ✅ Admin erstellen: `docker exec -it socialnet-backend python -m app.cli.manage_users create-admin ...`
5. ✅ Login testen auf http://localhost:4200/login

### Tägliche Entwicklung:

1. ✅ Code in `backend/app/` oder `frontend/src/` ändern
2. ✅ Änderungen werden automatisch erkannt (Hot-Reload)
3. ✅ Browser neu laden (Frontend) oder API-Request erneut senden (Backend)
4. ✅ Bei Problemen: Logs prüfen mit `docker compose logs -f backend`

### Bei Problemen:

1. ✅ `docker compose ps` - Status prüfen
2. ✅ `docker compose logs backend` - Logs lesen
3. ✅ `docker compose restart backend` - Service neustarten
4. ✅ `docker compose down && docker compose up -d` - Komplett neu starten

---

## Weiterführende Ressourcen

- [Docker Compose Dokumentation](https://docs.docker.com/compose/)
- [FastAPI in Docker](https://fastapi.tiangolo.com/deployment/docker/)
- [Angular Docker Best Practices](https://angular.io/guide/deployment)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
- [Kafka in Docker](https://docs.confluent.io/platform/current/installation/docker/installation.html)

---

**Bei Fragen oder Problemen:**
- Prüfen Sie die Docker-Logs: `docker compose logs -f`
- Öffnen Sie ein GitHub Issue
- API-Dokumentation: http://localhost:8000/docs
