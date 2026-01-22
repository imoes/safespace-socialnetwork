#!/bin/bash
# diagnose-complete-system.sh
# Vollständige System-Diagnose

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Complete System Diagnosis                           ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# ===== 1. Container Status =====
echo "=== 1. Container Status ==="
docker-compose ps
echo ""

# ===== 2. Backend Health =====
echo "=== 2. Backend Health Check ==="
echo -n "Backend (localhost:8000): "
if curl -s -m 5 http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ ERREICHBAR"
    curl -s http://localhost:8000/health | jq '.'
else
    echo "❌ NICHT ERREICHBAR!"
    echo ""
    echo "Backend-Logs (letzte 20 Zeilen):"
    docker logs --tail 20 socialnet-backend
fi
echo ""

# ===== 3. Frontend Health =====
echo "=== 3. Frontend Check ==="
echo -n "Frontend (localhost:4200): "
if curl -s -m 5 http://localhost:4200 > /dev/null 2>&1; then
    echo "✅ ERREICHBAR"
else
    echo "❌ NICHT ERREICHBAR!"
fi
echo ""

# ===== 4. Proxy Configuration =====
echo "=== 4. Proxy Configuration ==="
echo "frontend/proxy.conf.json:"
cat frontend/proxy.conf.json
echo ""

# ===== 5. Container Network Test =====
echo "=== 5. Container-to-Container Network ==="
echo -n "Frontend → Backend: "
if docker exec socialnet-frontend curl -s -m 5 http://backend:8000/health > /dev/null 2>&1; then
    echo "✅ VERBINDUNG OK"
    docker exec socialnet-frontend curl -s http://backend:8000/health | jq '.'
else
    echo "❌ VERBINDUNG FEHLGESCHLAGEN!"
    echo ""
    echo "Netzwerk-Diagnose:"
    docker exec socialnet-frontend ping -c 2 backend 2>&1 || echo "Ping failed"
    echo ""
    docker exec socialnet-frontend nslookup backend 2>&1 || echo "DNS resolution failed"
fi
echo ""

# ===== 6. Backend API Test =====
echo "=== 6. Backend API Endpoints Test ==="

# Health
echo -n "GET /health: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
echo "$HTTP_CODE $([ "$HTTP_CODE" = "200" ] && echo "✅" || echo "❌")"

# Register (test)
echo -n "POST /api/auth/register: "
REGISTER_TEST=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test123"}' 2>&1)
HTTP_CODE=$(echo "$REGISTER_TEST" | tail -1)
echo "$HTTP_CODE ($([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] && echo "OK - Backend antwortet" || echo "FEHLER"))"

# Me (without auth - should be 401)
echo -n "GET /api/auth/me (ohne Token): "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/auth/me)
echo "$HTTP_CODE $([ "$HTTP_CODE" = "401" ] && echo "✅ (korrekt)" || echo "❌")"

# Feed (without auth - should be 401)
echo -n "GET /api/feed (ohne Token): "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/feed?refresh=false&limit=50")
echo "$HTTP_CODE $([ "$HTTP_CODE" = "401" ] && echo "✅ (korrekt)" || echo "❌")"

echo ""

# ===== 7. Docker Networks =====
echo "=== 7. Docker Network Inspection ==="
echo "Container im socialnet_default Netzwerk:"
docker network inspect socialnet_default --format '{{range .Containers}}{{.Name}}: {{.IPv4Address}}{{println}}{{end}}'
echo ""

# ===== 8. Port Bindings =====
echo "=== 8. Port Bindings ==="
docker ps --format "table {{.Names}}\t{{.Ports}}" --filter "name=socialnet"
echo ""

# ===== 9. Backend Environment =====
echo "=== 9. Backend Environment Check ==="
echo "Backend URL Konfiguration:"
docker exec socialnet-backend env | grep -E "HOST|PORT|URL" || echo "Keine relevanten Env-Vars"
echo ""

# ===== 10. Frontend Proxy Test =====
echo "=== 10. Frontend Proxy Test (vom Container) ==="
echo "Test ob Frontend-Container Backend über 'backend:8000' erreicht:"
docker exec socialnet-frontend sh -c "wget -qO- http://backend:8000/health 2>&1" && echo "✅ SUCCESS" || echo "❌ FAILED"
echo ""

# ===== Zusammenfassung =====
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Diagnose-Zusammenfassung                            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

ISSUES=0

# Check Backend
if ! curl -s -m 5 http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ PROBLEM: Backend nicht erreichbar"
    echo "   → docker logs socialnet-backend"
    echo "   → docker-compose restart backend"
    ((ISSUES++))
fi

# Check Frontend
if ! curl -s -m 5 http://localhost:4200 > /dev/null 2>&1; then
    echo "❌ PROBLEM: Frontend nicht erreichbar"
    echo "   → docker logs socialnet-frontend"
    echo "   → docker-compose restart frontend"
    ((ISSUES++))
fi

# Check Proxy Config
if grep -q "localhost:8000" frontend/proxy.conf.json; then
    echo "⚠️  WARNUNG: Proxy zeigt auf localhost statt backend"
    echo "   → Sollte sein: \"target\": \"http://backend:8000\""
    ((ISSUES++))
fi

# Check Container Network
if ! docker exec socialnet-frontend curl -s -m 5 http://backend:8000/health > /dev/null 2>&1; then
    echo "❌ PROBLEM: Frontend → Backend Netzwerk-Verbindung fehlgeschlagen"
    echo "   → Prüfe Docker-Netzwerk"
    echo "   → docker network inspect socialnet_default"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ ALLE CHECKS ERFOLGREICH!"
    echo ""
    echo "Wenn du trotzdem 401 Fehler bekommst:"
    echo "  → Du musst dich EINLOGGEN (nicht nur registrieren!)"
    echo "  → Gehe zu http://localhost:4200/login"
    echo "  → Nach Login sollte alles funktionieren"
else
    echo ""
    echo "⚠️  $ISSUES Problem(e) gefunden - siehe oben für Details"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Quick Fixes                                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Backend neu starten:"
echo "  docker-compose restart backend"
echo ""
echo "Frontend neu starten:"
echo "  docker-compose restart frontend"
echo ""
echo "Alles neu starten:"
echo "  docker-compose restart"
echo ""
echo "Proxy-Config korrigieren:"
echo "  ./fix-frontend-backend-connection.sh"
echo ""
echo "Kompletter Reset:"
echo "  docker-compose down && docker-compose up -d"
