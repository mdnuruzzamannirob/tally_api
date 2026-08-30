#!/bin/bash

# Tally API Deployment Script
# Automated deployment with multiple options

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_IMAGE="tally-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    if [ ! -f "$PROJECT_DIR/.env.production" ]; then
        log_error ".env.production not found"
        log_warn "Copy from .env.example and update with your values"
        exit 1
    fi

    log_info "Prerequisites check passed ✓"
}

# Build Docker image
build() {
    log_info "Building Docker image..."

    local database_url
    if [ -f "$PROJECT_DIR/.env.production" ]; then
        database_url=$(grep "^DATABASE_URL=" "$PROJECT_DIR/.env.production" | cut -d= -f2-)
    fi

    if [ -z "$database_url" ]; then
        log_error "DATABASE_URL not found in .env.production"
        exit 1
    fi

    docker build \
        --target runtime \
        -t "$DOCKER_IMAGE:latest" \
        -t "$DOCKER_IMAGE:$(date +%Y%m%d-%H%M%S)" \
        --build-arg PRISMA_GENERATE_DATABASE_URL="$database_url" \
        "$PROJECT_DIR"

    log_info "Docker image built successfully ✓"
}

# Run migrations
migrate() {
    log_info "Running database migrations..."

    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.deploy.yml \
        --profile migration run --rm migrate

    log_info "Database migrations completed ✓"
}

# Start services
start() {
    log_info "Starting API services..."

    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.deploy.yml up -d

    log_info "Services started ✓"
    log_info "Waiting for health check to pass..."

    # Wait for health check to pass
    for i in {1..30}; do
        if docker-compose -f docker-compose.deploy.yml ps api | grep -q "healthy"; then
            log_info "API is healthy ✓"
            return 0
        fi
        echo "  Attempt $i/30..."
        sleep 2
    done

    log_warn "Health check timeout - service may still be starting"
}

# Stop services
stop() {
    log_info "Stopping services..."

    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.deploy.yml down

    log_info "Services stopped ✓"
}

# View logs
logs() {
    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.deploy.yml logs -f api
}

# Check deployment status
status() {
    log_info "Checking deployment status..."

    cd "$PROJECT_DIR"
    echo ""
    docker-compose -f docker-compose.deploy.yml ps
    echo ""

    # Health check
    log_info "Running health check..."
    if curl -s http://localhost:5000/api/v1/health | grep -q "ok"; then
        log_info "API health check: PASSED ✓"
    else
        log_warn "API health check: FAILED"
    fi
}

# Full deployment
deploy() {
    log_info "Starting full deployment..."
    check_prerequisites
    build
    migrate
    start
    status
    log_info "Deployment completed successfully ✓"
}

# Push image to registry
push() {
    local registry=${1:-""}

    if [ -z "$registry" ]; then
        log_error "Registry URL required: $0 push <registry>"
        exit 1
    fi

    log_info "Pushing image to $registry..."

    docker tag "$DOCKER_IMAGE:latest" "$registry/$DOCKER_IMAGE:latest"
    docker push "$registry/$DOCKER_IMAGE:latest"

    log_info "Image pushed successfully ✓"
}

# Test deployment
test() {
    log_info "Running deployment tests..."

    # Test health endpoint
    log_info "Testing health endpoint..."
    if ! curl -s http://localhost:5000/api/v1/health > /dev/null; then
        log_error "Health endpoint test failed"
        exit 1
    fi

    # Test OpenAPI endpoint
    log_info "Testing OpenAPI endpoint..."
    if ! curl -s http://localhost:5000/api/v1/openapi.json > /dev/null; then
        log_error "OpenAPI endpoint test failed"
        exit 1
    fi

    log_info "All deployment tests passed ✓"
}

# Print usage
usage() {
    cat << EOF
Tally API Deployment Script

Usage: $0 <command> [options]

Commands:
  check       - Check prerequisites only
  build       - Build Docker image
  migrate     - Run database migrations
  start       - Start API services
  stop        - Stop API services
  logs        - View service logs
  status      - Check deployment status
  test        - Run deployment tests
  deploy      - Full deployment (build → migrate → start)
  push <url>  - Push image to registry

Examples:
  # Full deployment
  $0 deploy

  # Just build
  $0 build

  # Start services
  $0 start

  # Check status
  $0 status

  # Push to registry
  $0 push my-registry.com

Environment:
  DOCKER_IMAGE - Override Docker image name (default: tally-api)

EOF
}

# Main
main() {
    local command="${1:-}"

    case "$command" in
        check)
            check_prerequisites
            ;;
        build)
            build
            ;;
        migrate)
            migrate
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        logs)
            logs
            ;;
        status)
            status
            ;;
        test)
            test
            ;;
        deploy)
            deploy
            ;;
        push)
            push "${2:-}"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
