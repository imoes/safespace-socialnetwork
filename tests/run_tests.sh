#!/bin/bash

# SafeSpace Social Network - Test Runner
# Einfaches Script zum Ausführen aller Tests

set -e

echo "=================================================================="
echo "🧪 SafeSpace Social Network - Test Suite"
echo "=================================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if services are running
check_service() {
    local url=$1
    local name=$2

    echo -n "Checking $name... "
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|401\|404"; then
        echo -e "${GREEN}✓${NC} Running"
        return 0
    else
        echo -e "${RED}✗${NC} Not running"
        return 1
    fi
}

echo "Checking services..."
echo ""

BACKEND_OK=true
FRONTEND_OK=true

check_service "http://localhost:8000/api/auth/me" "Backend (Port 8000)" || BACKEND_OK=false
check_service "http://localhost:4200" "Frontend (Port 4200)" || FRONTEND_OK=false

echo ""

if [ "$BACKEND_OK" = false ]; then
    echo -e "${RED}⚠️  Backend is not running!${NC}"
    echo "Please start backend: docker-compose up -d"
    echo ""
fi

if [ "$FRONTEND_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Frontend is not running!${NC}"
    echo "E2E tests will fail without frontend"
    echo "Please start frontend: cd frontend && npm start"
    echo ""
fi

# Parse arguments
RUN_BACKEND=true
RUN_E2E=true
HEADED=false
SLOW_MO=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            RUN_E2E=false
            shift
            ;;
        --e2e-only)
            RUN_BACKEND=false
            shift
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --slow)
            SLOW_MO="--slowmo 1000"
            shift
            ;;
        --help)
            echo "Usage: ./run_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend-only    Run only backend API tests"
            echo "  --e2e-only        Run only E2E tests"
            echo "  --headed          Run E2E tests with visible browser"
            echo "  --slow            Run E2E tests in slow motion"
            echo "  --help            Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create directories
mkdir -p logs screenshots

# Run Backend Tests
if [ "$RUN_BACKEND" = true ]; then
    echo "=================================================================="
    echo -e "${BLUE}🔧 Running Backend API Tests${NC}"
    echo "=================================================================="
    echo ""

    if [ "$BACKEND_OK" = true ]; then
        pytest test_backend_api.py -v -s --tb=short || {
            echo ""
            echo -e "${RED}❌ Backend tests failed${NC}"
            exit 1
        }
        echo ""
        echo -e "${GREEN}✅ Backend tests passed${NC}"
        echo ""
    else
        echo -e "${RED}❌ Skipping backend tests - backend not running${NC}"
        echo ""
    fi
fi

# Run E2E Tests
if [ "$RUN_E2E" = true ]; then
    echo "=================================================================="
    echo -e "${BLUE}🌐 Running E2E Tests (Playwright)${NC}"
    echo "=================================================================="
    echo ""

    if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
        E2E_ARGS="-v -s --tb=short"

        if [ "$HEADED" = true ]; then
            E2E_ARGS="$E2E_ARGS --headed"
        fi

        if [ -n "$SLOW_MO" ]; then
            E2E_ARGS="$E2E_ARGS $SLOW_MO"
        fi

        pytest test_e2e_playwright.py $E2E_ARGS || {
            echo ""
            echo -e "${RED}❌ E2E tests failed${NC}"
            exit 1
        }
        echo ""
        echo -e "${GREEN}✅ E2E tests passed${NC}"
        echo ""
    else
        echo -e "${RED}❌ Skipping E2E tests - services not running${NC}"
        echo ""
    fi
fi

# Summary
echo "=================================================================="
echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
echo "=================================================================="
echo ""
echo "📝 Logs are available in: tests/logs/"
echo "📸 Screenshots are available in: tests/screenshots/"
echo ""

# Show latest logs
LATEST_BACKEND_LOG=$(ls -t logs/backend_tests_*.log 2>/dev/null | head -1)
LATEST_E2E_LOG=$(ls -t logs/e2e_tests_*.log 2>/dev/null | head -1)

if [ -n "$LATEST_BACKEND_LOG" ]; then
    echo "Latest backend log: $LATEST_BACKEND_LOG"
fi

if [ -n "$LATEST_E2E_LOG" ]; then
    echo "Latest E2E log: $LATEST_E2E_LOG"
fi

echo ""
echo "To view logs:"
echo "  cat $LATEST_BACKEND_LOG"
echo "  cat $LATEST_E2E_LOG"
echo ""
