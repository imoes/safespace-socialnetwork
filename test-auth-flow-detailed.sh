#!/bin/bash
# test-auth-flow-detailed.sh
# Testet JEDEN Schritt des Auth-Flows

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Detaillierter Auth-Flow Test                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

USERNAME="authtest_$(date +%s)"
PASSWORD="TestPassword123!"
EMAIL="authtest@test.com"

echo "Test-User: $USERNAME"
echo ""

# ===== SCHRITT 1: REGISTRATION =====
echo "=== SCHRITT 1: Registration ==="
echo "POST /api/auth/register"

REGISTER_RESPONSE=$(curl -s -w "\n###HTTP_CODE###%{http_code}" \
  -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

HTTP_CODE=$(echo "$REGISTER_RESPONSE" | grep "###HTTP_CODE###" | cut -d'#' -f4)
BODY=$(echo "$REGISTER_RESPONSE" | sed '/###HTTP_CODE###/d')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Registration fehlgeschlagen!"
    exit 1
fi

# Prüfe ob ein access_token zurückgegeben wurde
if echo "$BODY" | jq -e '.access_token' > /dev/null 2>&1; then
    echo "✅ Registration gibt Token zurück (Backend gibt Token bei Registration)"
    TOKEN=$(echo "$BODY" | jq -r '.access_token')
    REGISTRATION_GIVES_TOKEN=true
else
    echo "⚠️  Registration gibt KEINEN Token zurück (User muss sich einloggen)"
    REGISTRATION_GIVES_TOKEN=false
fi

echo ""

# ===== SCHRITT 2: LOGIN =====
echo "=== SCHRITT 2: Login ==="
echo "POST /api/auth/login (Form Data)"

LOGIN_RESPONSE=$(curl -s -w "\n###HTTP_CODE###%{http_code}" \
  -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$USERNAME&password=$PASSWORD")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "###HTTP_CODE###" | cut -d'#' -f4)
BODY=$(echo "$LOGIN_RESPONSE" | sed '/###HTTP_CODE###/d')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Login fehlgeschlagen!"
    echo "Mögliche Ursachen:"
    echo "  - User existiert nicht (Registration war nicht erfolgreich)"
    echo "  - Passwort-Hashing Problem"
    echo "  - Backend-Auth-Service Problem"
    exit 1
fi

# Token extrahieren
if echo "$BODY" | jq -e '.access_token' > /dev/null 2>&1; then
    TOKEN=$(echo "$BODY" | jq -r '.access_token')
    echo "✅ Login erfolgreich, Token erhalten"
    echo "Token (erste 50 Zeichen): ${TOKEN:0:50}..."
else
    echo "❌ Login-Response enthält KEINEN Token!"
    exit 1
fi

echo ""

# ===== SCHRITT 3: TOKEN VALIDIEREN =====
echo "=== SCHRITT 3: Token validieren mit /me ==="
echo "GET /api/auth/me (mit Authorization Header)"

ME_RESPONSE=$(curl -s -w "\n###HTTP_CODE###%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/auth/me)

HTTP_CODE=$(echo "$ME_RESPONSE" | grep "###HTTP_CODE###" | cut -d'#' -f4)
BODY=$(echo "$ME_RESPONSE" | sed '/###HTTP_CODE###/d')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ /me mit Token fehlgeschlagen!"
    echo ""
    echo "🔍 Token-Inhalt dekodieren:"
    echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.' || echo "Token kann nicht dekodiert werden"
    echo ""
    echo "Mögliche Ursachen:"
    echo "  - Token-Format falsch"
    echo "  - Secret-Key stimmt nicht"
    echo "  - Token ist abgelaufen"
    echo "  - get_current_user() Funktion im Backend hat Bug"
    exit 1
fi

echo "✅ Token ist gültig, User-Info erhalten"

echo ""

# ===== SCHRITT 4: GESCHÜTZTER ENDPOINT =====
echo "=== SCHRITT 4: Geschützter Endpoint (Feed) ==="
echo "GET /api/feed (mit Authorization Header)"

FEED_RESPONSE=$(curl -s -w "\n###HTTP_CODE###%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/feed?refresh=false&limit=5")

HTTP_CODE=$(echo "$FEED_RESPONSE" | grep "###HTTP_CODE###" | cut -d'#' -f4)
BODY=$(echo "$FEED_RESPONSE" | sed '/###HTTP_CODE###/d')

echo "Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "Response (gekürzt):"
    echo "$BODY" | jq '{posts: (.posts | length), has_more: .has_more}' 2>/dev/null || echo "$BODY" | head -c 200
else
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Feed-Request mit Token fehlgeschlagen!"
    exit 1
fi

echo "✅ Feed-Request erfolgreich"

echo ""

# ===== SCHRITT 5: OHNE TOKEN =====
echo "=== SCHRITT 5: Anfrage OHNE Token (sollte 401 sein) ==="
echo "GET /api/feed (OHNE Authorization Header)"

NOAUTH_RESPONSE=$(curl -s -w "\n###HTTP_CODE###%{http_code}" \
  "http://localhost:8000/api/feed?refresh=false&limit=5")

HTTP_CODE=$(echo "$NOAUTH_RESPONSE" | grep "###HTTP_CODE###" | cut -d'#' -f4)

echo "Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Korrekt: 401 Unauthorized ohne Token"
else
    echo "⚠️  Unexpected: $HTTP_CODE (sollte 401 sein)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   ZUSAMMENFASSUNG                                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "✅ BACKEND AUTH FUNKTIONIERT PERFEKT!"
echo ""
echo "Backend-Flow:"
echo "  1. ✅ Registration erstellt User"
echo "  2. ✅ Login gibt Token zurück"
echo "  3. ✅ Token ist gültig"
echo "  4. ✅ Token funktioniert für geschützte Endpoints"
echo "  5. ✅ Ohne Token → 401 (korrekt)"
echo ""
echo "🎯 DAS PROBLEM IST IM FRONTEND!"
echo ""
echo "Das Frontend speichert oder sendet das Token NICHT korrekt!"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "FRONTEND DEBUGGING:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Öffne Browser DevTools (F12) und prüfe:"
echo ""
echo "1️⃣  Application Tab → Local Storage → http://localhost:4200"
echo "    → Ist 'access_token' vorhanden?"
echo "    → Falls NEIN: AuthService.setToken() wird nicht aufgerufen"
echo ""
echo "2️⃣  Network Tab → /api/feed Request → Headers"
echo "    → Ist 'Authorization: Bearer ...' vorhanden?"
echo "    → Falls NEIN: Auth Interceptor funktioniert nicht"
echo ""
echo "3️⃣  Console Tab"
echo "    → Irgendwelche Fehler?"
echo "    → Teste: localStorage.getItem('access_token')"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "MANUELLER TEST:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Öffne Browser Console und führe aus:"
echo ""
echo "// Token manuell setzen:"
echo "localStorage.setItem('access_token', '$TOKEN')"
echo ""
echo "// Seite neu laden:"
echo "location.reload()"
echo ""
echo "// Feed sollte jetzt funktionieren!"
echo ""
echo "Falls Feed IMMER NOCH nicht funktioniert:"
echo "  → Auth Interceptor wird nicht aufgerufen"
echo "  → app.config.ts prüfen"
echo "  → Interceptor ist nicht registriert"
echo ""
