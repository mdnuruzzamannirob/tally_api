#!/bin/bash

# Pre-Deployment Production Readiness Check
# Verifies all requirements are met before deploying

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

checks_passed=0
checks_failed=0
checks_total=0

check() {
    local name="$1"
    local command="$2"

    checks_total=$((checks_total + 1))
    printf "%-50s " "$name"

    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        checks_passed=$((checks_passed + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        checks_failed=$((checks_failed + 1))
    fi
}

section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "─────────────────────────────────────────────────────"
}

echo -e "${BLUE}╔═════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Tally API Production Readiness Check               ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════════╝${NC}"

# 1. Environment & Tools
section "Environment & Dependencies"
check "Node.js v20+" "node --version | grep -E 'v2[0-9]'"
check "pnpm v9+" "pnpm --version | grep -E '^9'"
check "Docker installed" "command -v docker"
check "Docker Compose v2+" "docker-compose --version | grep -E 'v?2'"
check "Git installed" "command -v git"
check "PostgreSQL client" "command -v psql || command -v pg_isready"

# 2. Project Configuration
section "Project Configuration"
check "package.json exists" "test -f $PROJECT_DIR/package.json"
check ".env.production exists" "test -f $PROJECT_DIR/.env.production"
check "Dockerfile exists" "test -f $PROJECT_DIR/Dockerfile"
check "docker-compose.deploy.yml exists" "test -f $PROJECT_DIR/docker-compose.deploy.yml"
check "tsconfig.json exists" "test -f $PROJECT_DIR/tsconfig.json"
check "prisma schema exists" "test -f $PROJECT_DIR/prisma/schema/base.prisma"

# 3. Environment Variables
section "Environment Variables"
check "DATABASE_URL configured" "grep -q '^DATABASE_URL=' $PROJECT_DIR/.env.production"
check "API_BASE_URL configured" "grep -q '^API_BASE_URL=' $PROJECT_DIR/.env.production"
check "WEB_APP_URL configured" "grep -q '^WEB_APP_URL=' $PROJECT_DIR/.env.production"
check "ACCESS_TOKEN_SECRET configured" "grep -q '^ACCESS_TOKEN_SECRET=' $PROJECT_DIR/.env.production"
check "NODE_ENV=production" "grep -q '^NODE_ENV=production$' $PROJECT_DIR/.env.production"
check "GOOGLE_CLIENT_ID set" "grep -q '^GOOGLE_CLIENT_ID=.*[A-Za-z0-9]' $PROJECT_DIR/.env.production"
check "GITHUB_CLIENT_ID set" "grep -q '^GITHUB_CLIENT_ID=.*[A-Za-z0-9]' $PROJECT_DIR/.env.production"

# 4. Code Quality
section "Code Quality"
check "No TypeScript errors" "pnpm typecheck" || true
check "Linting passes" "pnpm lint" || true
check "Tests pass" "pnpm test:unit" || true
check "Prisma schema valid" "pnpm db:validate"

# 5. Docker Configuration
section "Docker Configuration"
check "Dockerfile valid syntax" "docker build --target runtime --dry-run $PROJECT_DIR > /dev/null 2>&1"
check "Docker image builds" "docker build --target runtime -t tally-api:check --build-arg PRISMA_GENERATE_DATABASE_URL='postgresql://user:pass@localhost/db' $PROJECT_DIR > /dev/null 2>&1" || true

# 6. Database
section "Database Configuration"
check "DATABASE_URL not using localhost" "! grep -q 'DATABASE_URL=.*localhost' $PROJECT_DIR/.env.production"
check "Database password configured" "grep -q '^POSTGRES_PASSWORD=' $PROJECT_DIR/.env.production"

# 7. API Configuration
section "API Configuration"
check "PORT configured" "grep -q '^PORT=' $PROJECT_DIR/.env.production"
check "API_BASE_URL uses HTTPS" "grep -q '^API_BASE_URL=https://' $PROJECT_DIR/.env.production"
check "WEB_APP_URL configured" "grep -q '^WEB_APP_URL=' $PROJECT_DIR/.env.production"
check "LOG_LEVEL not debug" "! grep -q '^LOG_LEVEL=debug' $PROJECT_DIR/.env.production"

# 8. Security
section "Security Configuration"
check "COOKIE_SECURE=true" "grep -q '^COOKIE_SECURE=true' $PROJECT_DIR/.env.production"
check "COOKIE_SAME_SITE configured" "grep -q '^COOKIE_SAME_SITE=' $PROJECT_DIR/.env.production"
check "ACCESS_TOKEN_SECRET sufficient length" "test $(grep '^ACCESS_TOKEN_SECRET=' $PROJECT_DIR/.env.production | cut -d= -f2 | wc -c) -gt 32"

# 9. Email Configuration
section "Email Configuration"
check "EMAIL_PROVIDER configured" "grep -q '^EMAIL_PROVIDER=' $PROJECT_DIR/.env.production"
check "EMAIL_FROM configured" "grep -q '^EMAIL_FROM=' $PROJECT_DIR/.env.production"
check "Email credentials configured" "grep -q -E '^EMAIL_(API_KEY|SMTP_PASSWORD|MAILGUN_DOMAIN)=' $PROJECT_DIR/.env.production"

# Summary
echo ""
echo "─────────────────────────────────────────────────────"
echo -e "${BLUE}╔═════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   SUMMARY                              ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════════╝${NC}"

echo ""
echo "Total Checks: $checks_total"
echo -e "Passed:       ${GREEN}$checks_passed${NC}"
echo -e "Failed:       ${RED}$checks_failed${NC}"
echo ""

if [ $checks_failed -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo -e "${GREEN}Your backend is production-ready.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some checks failed.${NC}"
    echo -e "${YELLOW}Please review the failed checks above.${NC}"
    exit 1
fi
