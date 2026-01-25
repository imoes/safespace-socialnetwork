# SafeSpace Social Network - Test Suite

Umfassende Test-Suite mit Backend API Tests und End-to-End Tests mit Playwright.

## 📋 Übersicht

### Backend API Tests (`test_backend_api.py`)
- Testet alle Backend API Endpoints
- Registrierung, Login, Authentication
- Posts erstellen, bearbeiten, löschen
- Kommentare mit Guardian Modal (Hatespeech-Prüfung)
- Likes und Unlikes
- Benachrichtigungen
- Benutzersuche
- Detaillierte Logs mit Zeitstempel

### E2E Tests (`test_e2e_playwright.py`)
- Browser-basierte End-to-End Tests
- Testet die komplette Anwendung wie ein echter Benutzer
- User Registration und Login Flow
- Post-Erstellung mit Hashtags
- Kommentare und Guardian Modal
- Benachrichtigungen (Badge, Dropdown, Navigation)
- Auto-Expansion von Kommentaren
- Benutzersuche
- Screenshots bei jedem wichtigen Schritt
- Detaillierte Logs mit Zeitstempel

## 🚀 Installation

### 1. Python Dependencies installieren
```
# Dependencies installieren
sudo apt update
sudo apt install -y build-essential libssl-dev zlib1g-dev \
  libbz2-dev libreadline-dev libsqlite3-dev curl git \
  libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev \
  libffi-dev liblzma-dev

# pyenv installieren
curl https://pyenv.run | bash

# In ~/.bashrc einfügen
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo '[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc

# Shell neu laden
source ~/.bashrc

# Python 3.12.8 installieren
pyenv install 3.12.8

# Global oder lokal setzen
pyenv global 3.12.8        # systemweit
# oder
pyenv local 3.12.8         # nur im aktuellen Verzeichnis
´´´
```bash
cd /home/user/safespace-socialnetwork/tests
pip install -r requirements.txt
```

### 2. Playwright Browser installieren

```bash
playwright install chromium
```

## ▶️ Tests ausführen

### Backend API Tests

**Voraussetzung:** Backend muss laufen (Port 8000)

```bash
# Alle Backend Tests ausführen
pytest test_backend_api.py -v -s

# Einzelne Test-Klasse ausführen
pytest test_backend_api.py::TestAuthentication -v -s

# Einzelnen Test ausführen
pytest test_backend_api.py::TestAuthentication::test_login_success -v -s
```

### E2E Tests (Playwright)

**Voraussetzungen:**
- Backend muss laufen (Port 8000)
- Frontend muss laufen (Port 4200)

```bash
# Alle E2E Tests ausführen (Headless)
pytest test_e2e_playwright.py -v -s

# Mit sichtbarem Browser (Headed Mode)
pytest test_e2e_playwright.py -v -s --headed

# Slow Motion für bessere Sichtbarkeit (hilfreich beim Debuggen)
pytest test_e2e_playwright.py -v -s --headed --slowmo 1000

# Einzelne Test-Klasse ausführen
pytest test_e2e_playwright.py::TestComments -v -s --headed

# Einzelnen Test ausführen
pytest test_e2e_playwright.py::TestNotifications::test_notification_click_navigates_to_post -v -s --headed
```

### Alle Tests zusammen ausführen

```bash
# Backend Tests und dann E2E Tests
pytest test_backend_api.py test_e2e_playwright.py -v -s
```

## 📊 Test-Ausgaben

### Logs
Alle Tests erstellen detaillierte Log-Dateien:
- Backend Tests: `tests/logs/backend_tests_YYYYMMDD_HHMMSS.log`
- E2E Tests: `tests/logs/e2e_tests_YYYYMMDD_HHMMSS.log`

**Log-Format:**
```
2024-01-25 14:23:45 - INFO - ================================================================================
2024-01-25 14:23:45 - INFO - 🧪 TEST: Add Comment to Post
2024-01-25 14:23:45 - INFO - ================================================================================
2024-01-25 14:23:45 - INFO -    ▶️  User 1: Create post
2024-01-25 14:23:46 - INFO -    ✅ User 1: Post created
2024-01-25 14:23:46 - INFO -    ▶️  User 2: Navigate to feed and find post
2024-01-25 14:23:47 - INFO -    ▶️  User 2: Expand comments on post
2024-01-25 14:23:47 - INFO -    ▶️  User 2: Add comment
2024-01-25 14:23:48 - INFO -    📸 Screenshot: screenshots/user2_before_comment_submit_20240125_142348.png
2024-01-25 14:23:49 - INFO -    ✅ Comment added successfully
```

### Screenshots (nur E2E Tests)
- Automatische Screenshots bei wichtigen Schritten
- Gespeichert in: `tests/screenshots/`
- Dateiname enthält Timestamp: `user1_logged_in_20240125_142345.png`

### Pytest Output
```
tests/test_backend_api.py::TestAuthentication::test_register_success PASSED
tests/test_backend_api.py::TestAuthentication::test_login_success PASSED
tests/test_backend_api.py::TestPosts::test_create_post PASSED
tests/test_backend_api.py::TestComments::test_comment_with_hate_speech PASSED
tests/test_e2e_playwright.py::TestNotifications::test_notification_click_navigates_to_post PASSED
```

## 🧪 Test-Abdeckung

### Backend API Tests
- ✅ Authentifizierung (Register, Login, Token)
- ✅ Posts (Create, Update, Delete, Feed)
- ✅ Kommentare (Add, Get, Guardian Modal)
- ✅ Likes (Like, Unlike)
- ✅ Benachrichtigungen (Get, Mark Read, Delete, Unread Count)
- ✅ Benutzersuche

### E2E Tests
- ✅ User Registration Flow
- ✅ User Login Flow
- ✅ Post Creation (einfach und mit Hashtags)
- ✅ Kommentare hinzufügen
- ✅ Guardian Modal bei Hatespeech
- ✅ Alternative Formulierungen wählen
- ✅ Benachrichtigungen anzeigen
- ✅ Notification Badge
- ✅ Navigation via Benachrichtigung
- ✅ Auto-Expansion von Kommentaren
- ✅ Benutzersuche

## 🔧 Troubleshooting

### Backend Tests schlagen fehl

**Problem:** Connection refused
```
requests.exceptions.ConnectionError: ('Connection aborted.', ConnectionRefusedError(111, 'Connection refused'))
```

**Lösung:** Backend starten
```bash
cd /home/user/safespace-socialnetwork
docker-compose up -d
```

### E2E Tests schlagen fehl

**Problem:** Timeout beim Warten auf Elemente
```
playwright._impl._api_types.TimeoutError: Timeout 10000ms exceeded.
```

**Lösungen:**
1. Frontend und Backend müssen laufen
2. Ports prüfen (Frontend: 4200, Backend: 8000)
3. Mit `--headed` ausführen um zu sehen, was passiert
4. Timeout erhöhen falls nötig

**Problem:** Playwright Browser nicht installiert
```
playwright._impl._driver.TargetClosedError: Browser closed.
```

**Lösung:** Browser installieren
```bash
playwright install chromium
```

### Nützliche Debugging-Optionen

```bash
# Mit Browser sichtbar + Slow Motion
pytest test_e2e_playwright.py -v -s --headed --slowmo 2000

# Browser nach Test offen lassen (für Inspektion)
pytest test_e2e_playwright.py -v -s --headed --pause-on-failure

# Verbose Output für Debugging
pytest test_e2e_playwright.py -v -s --headed --log-cli-level=DEBUG
```

## 📝 Test-Ergebnisse interpretieren

### Erfolgreiche Tests
```
tests/test_backend_api.py::TestComments::test_comment_with_hate_speech PASSED [100%]

2024-01-25 14:23:50 - INFO - ✅ Hate speech detected, Guardian Modal data provided
2024-01-25 14:23:50 - INFO -    Explanation: Der Kommentar enthält beleidigende und diskriminierende...
```

### Fehlgeschlagene Tests
```
tests/test_e2e_playwright.py::TestNotifications::test_notification_badge FAILED

E   playwright._impl._api_types.TimeoutError: Timeout 10000ms exceeded.
E   =========================== logs ===========================
E   waiting for selector ".notification-badge"
```

**Hinweise im Log:**
- ❌ = Fehler
- ⚠️ = Warnung
- ✅ = Erfolg
- ▶️ = Schritt wird ausgeführt
- 📸 = Screenshot erstellt
- 📊 = Daten geladen

## 🎯 Empfohlene Test-Reihenfolge

1. **Backend Tests zuerst ausführen** (schnell, keine Browser)
   ```bash
   pytest test_backend_api.py -v -s
   ```

2. **E2E Tests einzeln ausführen** (langsamer, aber umfassend)
   ```bash
   pytest test_e2e_playwright.py::TestAuthentication -v -s --headed
   pytest test_e2e_playwright.py::TestPostCreation -v -s --headed
   pytest test_e2e_playwright.py::TestComments -v -s --headed
   pytest test_e2e_playwright.py::TestNotifications -v -s --headed
   ```

3. **Alle Tests zusammen** (Vollständige Regression)
   ```bash
   pytest -v -s
   ```

## 📈 Performance

**Backend API Tests:**
- Durchschnittliche Laufzeit: ~30-60 Sekunden
- Schnell, da nur HTTP Requests

**E2E Tests:**
- Durchschnittliche Laufzeit: ~5-10 Minuten
- Langsamer, da Browser-basiert und Wartezeiten

## 🔄 CI/CD Integration

Tests können in CI/CD Pipelines integriert werden:

```yaml
# Beispiel: GitHub Actions
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - name: Install dependencies
      run: |
        pip install -r tests/requirements.txt
        playwright install chromium
    - name: Start services
      run: docker-compose up -d
    - name: Run backend tests
      run: pytest tests/test_backend_api.py -v
    - name: Run E2E tests
      run: pytest tests/test_e2e_playwright.py -v
    - name: Upload logs
      uses: actions/upload-artifact@v2
      with:
        name: test-logs
        path: tests/logs/
```

## 💡 Best Practices

1. **Logs immer prüfen** - Auch wenn Tests grün sind, Log-Dateien zeigen Details
2. **Screenshots nutzen** - Bei E2E Tests helfen Screenshots beim Debugging
3. **Headed Mode beim Entwickeln** - Sichtbarer Browser hilft beim Verstehen
4. **Einzelne Tests zuerst** - Erst einzelne Tests, dann komplette Suite
5. **Backend vor E2E** - Backend Tests sind schneller und finden API-Probleme früher

## 📞 Support

Bei Problemen mit den Tests:
1. Logs in `tests/logs/` prüfen
2. Screenshots in `tests/screenshots/` prüfen (E2E)
3. Mit `--headed` und `--slowmo` debuggen
4. Test einzeln mit `-v -s` ausführen für mehr Output
