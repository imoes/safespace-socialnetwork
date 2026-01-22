#!/bin/bash
# debug-auth-issue.sh
# Findet GENAU wo das Problem liegt

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   AUTH DEBUG MODE - Detaillierte Fehlersuche          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# ===== SCHRITT 1: Container Status =====
echo "=== SCHRITT 1: Container Status ==="
echo ""
echo "Alle socialnet Container:"
docker ps -a --filter "name=socialnet" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

BACKEND_RUNNING=$(docker ps --filter "name=socialnet-backend" --filter "status=running" -q)
if [ -z "$BACKEND_RUNNING" ]; then
    echo "❌ PROBLEM GEFUNDEN: Backend-Container läuft NICHT!"
    echo ""
    echo "Backend-Container Status:"
    docker ps -a --filter "name=socialnet-backend" --format "{{.Status}}"
    echo ""
    echo "Versuche Backend zu starten..."
    docker-compose up -d backend
    sleep 10
else
    echo "✅ Backend-Container läuft"
fi

# ===== SCHRITT 2: Backend Logs =====
echo ""
echo "=== SCHRITT 2: Backend Logs (letzte 50 Zeilen) ==="
echo ""
docker logs --tail 50 socialnet-backend 2>&1
echo ""

# ===== SCHRITT 3: Prüfe auth.py =====
echo "=== SCHRITT 3: Prüfe auth.py Datei ==="
echo ""

if [ ! -f "backend/app/api/auth.py" ]; then
    echo "❌ PROBLEM: backend/app/api/auth.py existiert nicht!"
    exit 1
fi

echo "Zeile 20-21 (Register Endpoint Definition):"
sed -n '20,21p' backend/app/api/auth.py
echo ""

echo "Prüfe response_model:"
if grep -n "response_model=Token" backend/app/api/auth.py | head -1; then
    echo "✅ response_model=Token gefunden"
else
    echo "❌ PROBLEM: response_model ist NICHT Token!"
    echo ""
    echo "Aktueller Wert:"
    grep -n "@router.post.*register" backend/app/api/auth.py -A 1
    echo ""
    echo "FIX WIRD ANGEWENDET..."
    
    # Backup
    cp backend/app/api/auth.py backend/app/api/auth.py.debug-backup
    
    # Fix: Ändere response_model zu Token
    sed -i 's/@router.post("\/register", response_model=UserProfile)/@router.post("\/register", response_model=Token)/g' backend/app/api/auth.py
    
    echo "✅ Geändert zu response_model=Token"
    echo "Verifiziere:"
    grep -n "@router.post.*register" backend/app/api/auth.py -A 1
fi

echo ""
echo "Zeilen 33-44 (Token-Erstellung):"
sed -n '33,44p' backend/app/api/auth.py
echo ""

# Prüfe ob Token erstellt wird
if grep -q "create_access_token" backend/app/api/auth.py | head -1; then
    echo "✅ create_access_token gefunden"
else
    echo "❌ PROBLEM: create_access_token fehlt in register()!"
fi

# ===== SCHRITT 4: Backend Health =====
echo ""
echo "=== SCHRITT 4: Backend Erreichbarkeit ==="
echo ""

echo -n "Health Check: "
HEALTH=$(curl -s -w "\n%{http_code}" http://localhost:8000/health 2>&1)
HTTP_CODE=$(echo "$HEALTH" | tail -1)
BODY=$(echo "$HEALTH" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Backend ist erreichbar (200 OK)"
    echo "Response: $BODY"
else
    echo "❌ Backend antwortet NICHT (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    echo ""
    echo "Backend muss neu gestartet werden!"
    echo "Starte Backend neu..."
    docker-compose restart backend
    echo "Warte 20 Sekunden..."
    sleep 20
    
    echo ""
    echo "Erneuter Health Check:"
    curl -s http://localhost:8000/health 2>&1 || echo "Immer noch nicht erreichbar!"
fi

# ===== SCHRITT 5: Detaillierter Registration Test =====
echo ""
echo "=== SCHRITT 5: Detaillierter Registration Test ==="
echo ""

USERNAME="debugtest_$(date +%s)"
PASSWORD="TestPass123!"
EMAIL="debug@test.com"

echo "Test-User: $USERNAME"
echo ""

# RAW Request mit allen Details
echo "Sende POST /api/auth/register..."
echo "URL: http://localhost:8000/api/auth/register"
echo "Body: {\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
echo ""

RESPONSE=$(curl -v -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  2>&1)

echo "=== VOLLSTÄNDIGE RAW RESPONSE ==="
echo "$RESPONSE"
echo "================================"
echo ""

# Extrahiere HTTP Status
HTTP_STATUS=$(echo "$RESPONSE" | grep "< HTTP" | awk '{print $3}')
echo "HTTP Status: $HTTP_STATUS"
echo ""

# Extrahiere Body
BODY=$(echo "$RESPONSE" | sed -n '/^{/,/^}/p' | head -1)
echo "Response Body:"
echo "$BODY"
echo ""

# Prüfe auf Token
if echo "$BODY" | grep -q "access_token"; then
    echo "✅✅✅ SUCCESS! Token gefunden!"
    TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    echo "Token: ${TOKEN:0:50}..."
    
    # Test mit Token
    echo ""
    echo "Teste Token mit /me..."
    ME_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me)
    echo "$ME_RESPONSE" | jq '.'
    
elif echo "$BODY" | grep -q "uid"; then
    echo "❌ PROBLEM: Response enthält User-Objekt, aber KEINEN Token!"
    echo ""
    echo "Das bedeutet:"
    echo "  → auth.py wurde NICHT korrekt geändert"
    echo "  → ODER Backend läuft noch mit alter Version"
    echo ""
    echo "Response-Struktur:"
    echo "$BODY" | jq 'keys' 2>/dev/null || echo "$BODY"
    
else
    echo "❌ FEHLER: Unerwartete Response!"
    echo ""
    echo "Das könnte sein:"
    echo "  → Backend-Error"
    echo "  → Invalid JSON"
    echo "  → Network Problem"
fi

# ===== SCHRITT 6: Code-Verifikation =====
echo ""
echo "=== SCHRITT 6: Code-Verifikation ==="
echo ""

echo "Prüfe KOMPLETTE register() Funktion:"
echo ""
sed -n '/@router.post("\/register"/,/^$/p' backend/app/api/auth.py | head -30
echo ""

# ===== SCHRITT 7: Docker Logs nach Test =====
echo ""
echo "=== SCHRITT 7: Backend Logs (letzte 20 Zeilen nach Test) ==="
echo ""
docker logs --tail 20 socialnet-backend

# ===== ZUSAMMENFASSUNG =====
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   DEBUG ZUSAMMENFASSUNG                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Prüfungen
ISSUES=0

# 1. Backend läuft?
if [ -z "$BACKEND_RUNNING" ]; then
    echo "❌ Backend läuft nicht"
    ((ISSUES++))
fi

# 2. Health Check OK?
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Backend Health Check fehlgeschlagen"
    ((ISSUES++))
fi

# 3. auth.py korrekt?
if ! grep -q "response_model=Token" backend/app/api/auth.py; then
    echo "❌ auth.py hat NICHT response_model=Token"
    ((ISSUES++))
fi

# 4. Token in Response?
if ! echo "$BODY" | grep -q "access_token"; then
    echo "❌ Registration gibt KEINEN Token zurück"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅✅✅ ALLES OK - Auth funktioniert!"
else
    echo "⚠️  $ISSUES Problem(e) gefunden"
    echo ""
    echo "MÖGLICHE LÖSUNGEN:"
    echo ""
    echo "1. Backend komplett neu bauen:"
    echo "   docker-compose stop backend"
    echo "   docker-compose build backend --no-cache"
    echo "   docker-compose up -d backend"
    echo ""
    echo "2. auth.py manuell prüfen und bearbeiten"
    echo ""
    echo "3. Gesamtes System neu starten:"
    echo "   docker-compose down"
    echo "   docker-compose up -d"
fi

echo ""
echo "Debug-Backup erstellt: backend/app/api/auth.py.debug-backup"
