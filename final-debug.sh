#!/bin/bash
# final-debug.sh
# Findet das genaue Problem

echo "╔════════════════════════════════════════════════════════╗"
echo "║   FINAL DEBUG - Token Problem                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

echo "Teste im Browser Console:"
echo ""
echo "1. Prüfe Token:"
echo "   localStorage.getItem('access_token')"
echo ""
echo "2. Wenn Token da ist, kopiere ihn:"
echo "   const token = localStorage.getItem('access_token')"
echo "   console.log(token)"
echo ""
echo "3. Teste Token direkt gegen Backend:"
echo ""

echo "Erstelle Test-User und hole Token..."
USERNAME="debuguser_$(date +%s)"
PASSWORD="Test123!"

# Registration
REG_RESULT=$(curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"email\":\"$USERNAME@test.com\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$REG_RESULT" | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Konnte keinen Token holen"
    echo "Response: $REG_RESULT"
    exit 1
fi

echo "✅ Token erhalten: ${TOKEN:0:50}..."
echo ""

# Test /me mit Token
echo "=== Test 1: /me mit Token (direkt vom Backend) ==="
ME_RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me)
echo "$ME_RESULT" | jq '.'

if echo "$ME_RESULT" | jq -e '.uid' > /dev/null 2>&1; then
    echo "✅ Token ist GÜLTIG!"
else
    echo "❌ Token ist UNGÜLTIG!"
    exit 1
fi

echo ""
echo "=== Test 2: Token Format ==="
echo "Token Länge: ${#TOKEN}"
echo "Token beginnt mit: ${TOKEN:0:20}"
echo ""

# Decode JWT (nur Payload)
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
# Pad base64
case $((${#PAYLOAD} % 4)) in
    2) PAYLOAD="${PAYLOAD}==" ;;
    3) PAYLOAD="${PAYLOAD}=" ;;
esac

echo "Decoded Token Payload:"
echo "$PAYLOAD" | base64 -d 2>/dev/null | jq '.' || echo "Konnte nicht dekodieren"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   BROWSER TEST                                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Im Browser Console testen:"
echo ""
echo "// 1. Lösche alten Token"
echo "localStorage.clear()"
echo ""
echo "// 2. Setze working Token"
echo "localStorage.setItem('access_token', '$TOKEN')"
echo ""
echo "// 3. Test fetch mit korrektem Token"
echo "fetch('http://localhost:8000/api/auth/me', {"
echo "  headers: { 'Authorization': 'Bearer $TOKEN' }"
echo "}).then(r => r.json()).then(console.log)"
echo ""
echo "// Sollte User-Daten zeigen!"
echo ""
echo "// 4. Reload page"
echo "location.reload()"
echo ""
echo "// Feed sollte dann laden!"
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   DIAGNOSE                                             ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Problem: Interceptor-Logs fehlen komplett!"
echo "Das bedeutet: Interceptor wird NICHT aufgerufen!"
echo ""
echo "Mögliche Ursachen:"
echo "  1. app.config.ts - Interceptor nicht richtig registriert"
echo "  2. Angular HttpClient wird nicht verwendet"
echo "  3. Build-Cache - Frontend muss neu gebaut werden"
echo ""
echo "LÖSUNG:"
echo "  1. Frontend neu starten:"
echo "     docker-compose restart frontend"
echo ""
echo "  2. Browser Cache leeren + Hard Reload (Strg+Shift+R)"
echo ""
echo "  3. Oder: Token manuell setzen und testen (siehe oben)"
