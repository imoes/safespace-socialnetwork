# Lokale Entwicklung (ohne Docker)

Diese Anleitung erklärt, wie Sie das SafeSpace-Projekt **ohne Docker** auf Ihrem lokalen System entwickeln können.

## Problemlösung: 401 Login-Fehler

**Symptom:** Nach dem Erstellen eines Admins schlägt der Login mit 401 Unauthorized fehl.

**Ursache:** Die Standard-Proxy-Konfiguration (`frontend/proxy.conf.json`) zeigt auf `http://socialnet-backend:8000`, einen Docker-Hostnamen. Wenn das Backend lokal läuft, muss der Proxy auf `http://localhost:8000` zeigen.

**Lösung:** Die Proxy-Konfiguration wurde bereits auf `localhost` geändert. Siehe unten für Details.

---

## Voraussetzungen

### 1. Backend (Python/FastAPI)
```bash
# Python 3.11+ installieren
python --version  # sollte 3.11 oder höher sein

# PostgreSQL installieren und starten
# macOS:
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian:
sudo apt install postgresql-16
sudo systemctl start postgresql

# Datenbank erstellen
createdb socialnet
createuser -P socialnet  # Passwort: changeme
```

### 2. Redis
```bash
# Redis installieren und starten
# macOS:
brew install redis
brew services start redis

# Ubuntu/Debian:
sudo apt install redis-server
sudo systemctl start redis
```

### 3. MinIO (optional, für Media-Upload)
```bash
# Herunterladen und starten:
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
./minio server /tmp/minio-data --console-address ":9001"

# Zugangsdaten:
# Access Key: minioadmin
# Secret Key: minioadmin
```

### 4. Kafka & Zookeeper (optional, für AI-Moderation)
Für die vollständige AI-Moderation werden Kafka und Zookeeper benötigt. Diese laufen am besten in Docker:

```bash
# Nur Kafka und Zookeeper starten:
docker-compose up -d zookeeper kafka
```

---

## Backend starten

### 1. Umgebung vorbereiten

```bash
cd backend

# Virtual Environment erstellen
python -m venv venv
source venv/bin/activate  # Linux/macOS
# ODER: venv\Scripts\activate  # Windows

# Dependencies installieren
pip install -r requirements.txt
```

### 2. Konfiguration (.env erstellen)

```bash
# .env-Datei im backend/-Verzeichnis erstellen:
cat > .env <<EOF
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=socialnet
POSTGRES_USER=socialnet
POSTGRES_PASSWORD=changeme

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secret (generieren mit: openssl rand -hex 32)
SECRET_KEY=$(openssl rand -hex 32)

# DeepSeek API (optional, für AI-Moderation)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# MinIO (optional, für Media-Upload)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

# Kafka (optional)
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
EOF
```

### 3. Datenbank initialisieren

```bash
# Tabellen werden automatisch beim ersten Start erstellt
# Alternativ: Migrationen manuell ausführen (falls vorhanden)
# alembic upgrade head
```

### 4. Backend starten

```bash
# Mit Hot-Reload (Entwicklung):
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ODER: Produktions-Modus:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Backend läuft jetzt auf:** http://localhost:8000

**API-Dokumentation:** http://localhost:8000/docs

### 5. Admin-User erstellen

```bash
# Im backend/-Verzeichnis:
python -m app.cli.manage_users create-admin admin admin@example.com IhrPasswort123

# WICHTIG: Notieren Sie sich Username und Passwort!
```

---

## Frontend starten

### 1. Dependencies installieren

```bash
cd frontend
npm install
```

### 2. Proxy-Konfiguration prüfen

Die Datei `frontend/proxy.conf.json` sollte so aussehen:

```json
{
  "/api": {
    "target": "http://localhost:8000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

**Für Docker-Entwicklung** verwenden Sie `proxy.conf.docker.json`:
```json
{
  "/api": {
    "target": "http://socialnet-backend:8000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

### 3. Frontend starten

```bash
# Mit Proxy (Standard):
npm start
# ODER explizit:
ng serve --proxy-config proxy.conf.json

# Frontend läuft auf: http://localhost:4200
```

### 4. Login testen

1. Öffnen Sie http://localhost:4200
2. Navigieren Sie zu `/login`
3. Geben Sie die Admin-Credentials ein
4. Bei Erfolg werden Sie zum Feed weitergeleitet

**Bei 401-Fehlern:**
- Prüfen Sie, ob das Backend läuft: http://localhost:8000/docs
- Prüfen Sie die Browser-Konsole (F12 → Console)
- Prüfen Sie die Backend-Logs im Terminal

---

## Wechsel zwischen lokaler und Docker-Entwicklung

### Lokale Entwicklung (Backend auf localhost:8000)

```bash
# Frontend-Proxy auf localhost zeigen:
cp frontend/proxy.conf.json.bak frontend/proxy.conf.json  # Falls Backup existiert
# ODER manuell editieren: "target": "http://localhost:8000"

# Backend lokal starten:
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend starten:
cd frontend
npm start
```

### Docker-Entwicklung (alles in Containern)

```bash
# Frontend-Proxy auf Docker-Hostname zeigen:
# Editiere frontend/proxy.conf.json:
# "target": "http://socialnet-backend:8000"

# ODER verwende die Docker-Proxy-Konfiguration:
# In docker-compose.yml für das Frontend:
#   command: ng serve --host 0.0.0.0 --proxy-config proxy.conf.docker.json

# Alle Services starten:
docker-compose up -d

# Admin erstellen:
docker exec -it socialnet-backend python -m app.cli.manage_users \
  create-admin admin admin@example.com IhrPasswort123
```

---

## Fehlerdiagnose

### 1. Backend startet nicht

**Fehler:** `Connection refused` bei PostgreSQL/Redis

**Lösung:**
```bash
# PostgreSQL prüfen:
pg_isready
# Falls nicht aktiv:
brew services start postgresql@16  # macOS
sudo systemctl start postgresql    # Linux

# Redis prüfen:
redis-cli ping
# Falls nicht aktiv:
brew services start redis           # macOS
sudo systemctl start redis          # Linux
```

**Fehler:** `bcrypt` Build-Fehler

**Lösung:**
```bash
pip install --upgrade pip setuptools wheel
pip install bcrypt==4.0.1
```

### 2. Frontend kann Backend nicht erreichen

**Fehler:** `POST http://localhost:4200/api/auth/login 401 (Unauthorized)`

**Ursache:** Proxy-Konfiguration zeigt nicht auf das richtige Backend.

**Lösung:**
```bash
# Prüfen Sie proxy.conf.json:
cat frontend/proxy.conf.json

# Sollte sein:
# "target": "http://localhost:8000"  (für lokale Entwicklung)

# Backend muss laufen:
curl http://localhost:8000/docs
# Sollte die API-Dokumentation zurückgeben
```

### 3. Login schlägt mit 401 fehl

**Ursache 1:** Admin-User existiert nicht
```bash
# Im backend/-Verzeichnis:
python -m app.cli.manage_users create-admin admin admin@example.com TestPasswort123
```

**Ursache 2:** Falsches Passwort
- Verwenden Sie das Passwort, das Sie bei `create-admin` angegeben haben

**Ursache 3:** Secret Key stimmt nicht
- Stellen Sie sicher, dass `SECRET_KEY` in `.env` gesetzt ist
- Verwenden Sie immer denselben Secret Key

### 4. Token wird nicht gespeichert

**Symptom:** Console zeigt "NO TOKEN AVAILABLE"

**Lösung:**
1. Öffnen Sie Browser DevTools (F12)
2. Gehen Sie zu **Application → Local Storage**
3. Prüfen Sie, ob `access_token` nach dem Login vorhanden ist
4. Falls nicht: Löschen Sie alle Cookies und LocalStorage, neu laden

### 5. CORS-Fehler

**Fehler:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Lösung:**
Das Backend sollte bereits CORS für `http://localhost:4200` erlauben. Falls nicht:

Editieren Sie `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://localhost:4200"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Nützliche Befehle

### Backend

```bash
# Dependencies aktualisieren
pip install -r requirements.txt

# User-Management
python -m app.cli.manage_users create-admin <username> <email> <password>
python -m app.cli.manage_users create-moderator <username> <email> <password>
python -m app.cli.manage_users promote <username> <role>

# Tests ausführen
pytest

# Logs anzeigen (wenn im Hintergrund)
tail -f backend.log
```

### Frontend

```bash
# Dependencies aktualisieren
npm install

# Build für Produktion
ng build --configuration production

# Tests ausführen
ng test

# E2E-Tests
ng e2e

# Code-Formatierung prüfen
npm run lint
```

### Datenbank

```bash
# PostgreSQL-Konsole öffnen
psql -U socialnet -d socialnet

# Alle Tabellen anzeigen
\dt

# User abfragen
SELECT uid, username, email, role FROM users;

# Redis-Konsole öffnen
redis-cli

# Alle Keys anzeigen
KEYS *

# Feed-Cache prüfen
GET feed:user:<uid>
```

---

## Zusammenfassung

Für **lokale Entwicklung ohne Docker**:

1. ✅ PostgreSQL und Redis lokal installieren und starten
2. ✅ Backend mit `uvicorn app.main:app --reload` starten
3. ✅ **Wichtig:** `proxy.conf.json` muss auf `http://localhost:8000` zeigen
4. ✅ Frontend mit `npm start` starten
5. ✅ Admin mit `python -m app.cli.manage_users create-admin` erstellen
6. ✅ Login auf http://localhost:4200/login testen

Für **Docker-Entwicklung**:

1. ✅ `docker-compose up -d` starten
2. ✅ **Wichtig:** `proxy.conf.json` muss auf `http://socialnet-backend:8000` zeigen (oder verwenden Sie `proxy.conf.docker.json`)
3. ✅ Admin mit `docker exec -it socialnet-backend python -m app.cli.manage_users create-admin ...` erstellen
4. ✅ Login auf http://localhost:4200/login testen

---

**Bei Fragen oder Problemen:**
- Prüfen Sie die Browser-Konsole (F12)
- Prüfen Sie die Backend-Logs im Terminal
- Öffnen Sie ein GitHub Issue
