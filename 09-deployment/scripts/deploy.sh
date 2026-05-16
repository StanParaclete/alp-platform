#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ALP Platform — Deployment & Setup Scripts
# Built by Stan Paraclete | www.stanparaclete.com
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; PURPLE='\033[0;35m'; NC='\033[0m'

log()  { echo -e "${GREEN}[ALP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# SCRIPT: setup.sh  —  First-time local dev setup
# ─────────────────────────────────────────────────────────────────────────────

setup_local() {
  echo -e "${PURPLE}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║   ALP Platform — Local Dev Setup v2.4.1      ║"
  echo "  ║   Built by Stan Paraclete                     ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${NC}"

  # Node check
  NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
  [ "$NODE_VERSION" -lt 20 ] && err "Node.js 20+ required. Got v${NODE_VERSION}"
  log "Node.js v${NODE_VERSION} ✓"

  # Docker check
  docker info > /dev/null 2>&1 || err "Docker not running. Start Docker Desktop and retry."
  log "Docker running ✓"

  # Start dev databases
  log "Starting PostgreSQL + Redis..."
  docker compose -f 09-deployment/docker-compose.yml up -d postgres redis
  sleep 3

  # Backend setup
  log "Setting up backend..."
  cd 05-backend
  [ ! -f .env ] && cp .env.example .env && warn "Created .env from example — add your API keys!"
  npm install
  npx prisma generate
  npx prisma migrate deploy
  cd ..

  # Seed database
  log "Seeding demo data..."
  cd 05-backend && node src/seed.js && cd ..

  log "Setup complete! 🎉"
  echo ""
  echo -e "${GREEN}Demo credentials:${NC}"
  echo "  Email:    ms.simmons@westwood.edu"
  echo "  Password: ALPDemo2026!"
  echo ""
  echo -e "${BLUE}Start the backend:${NC}    cd 05-backend && npm run dev"
  echo -e "${BLUE}Start the webapp:${NC}     cd 02-webapp  && npm run dev"
  echo ""
}


# ─────────────────────────────────────────────────────────────────────────────
# SCRIPT: deploy.sh  —  Production deployment to VPS/cloud
# ─────────────────────────────────────────────────────────────────────────────

deploy_production() {
  log "Deploying ALP Platform to production..."

  # Build Docker images
  log "Building backend image..."
  docker build -t alp-backend:latest -f 05-backend/Dockerfile ./05-backend

  log "Building webapp image..."
  docker build -t alp-webapp:latest -f 02-webapp/Dockerfile ./02-webapp

  # Push to registry
  if [ -n "$REGISTRY" ]; then
    log "Pushing to registry: $REGISTRY"
    docker tag alp-backend:latest "$REGISTRY/alp-backend:latest"
    docker tag alp-webapp:latest  "$REGISTRY/alp-webapp:latest"
    docker push "$REGISTRY/alp-backend:latest"
    docker push "$REGISTRY/alp-webapp:latest"
  fi

  # Deploy
  log "Running docker compose up..."
  cd 09-deployment
  docker compose pull
  docker compose up -d --remove-orphans

  # Migrate
  log "Running database migrations..."
  docker compose exec backend npx prisma migrate deploy

  log "✅ Production deployment complete!"
  echo "  → https://growwithalp.com"
  echo "  → https://app.growwithalp.com"
}


# ─────────────────────────────────────────────────────────────────────────────
# SCRIPT: ssl-setup.sh  —  Let's Encrypt SSL certificate setup
# ─────────────────────────────────────────────────────────────────────────────

setup_ssl() {
  DOMAIN=${1:-growwithalp.com}
  EMAIL=${2:-hello@stanparaclete.com}

  log "Setting up SSL for $DOMAIN..."

  # Initial HTTP-only nginx for cert challenge
  docker compose -f 09-deployment/docker-compose.yml run --rm certbot \
    certonly --webroot \
    -w /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "app.$DOMAIN"

  log "SSL certificates obtained for $DOMAIN ✓"
  log "Restarting nginx with SSL..."
  docker compose -f 09-deployment/docker-compose.yml restart nginx
}


# ─────────────────────────────────────────────────────────────────────────────
# SCRIPT: backup.sh  —  Database backup to S3
# ─────────────────────────────────────────────────────────────────────────────

backup_database() {
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="alp_backup_${TIMESTAMP}.sql"

  log "Backing up database..."
  docker compose -f 09-deployment/docker-compose.yml exec -T postgres \
    pg_dump -U alp_user alp_db > "/tmp/$BACKUP_FILE"

  if [ -n "$AWS_S3_BUCKET" ]; then
    log "Uploading to S3..."
    aws s3 cp "/tmp/$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/$BACKUP_FILE"
    rm "/tmp/$BACKUP_FILE"
    log "Backup uploaded: s3://$AWS_S3_BUCKET/backups/$BACKUP_FILE ✓"
  else
    log "Backup saved: /tmp/$BACKUP_FILE"
    warn "Set AWS_S3_BUCKET to enable cloud backups"
  fi
}


# ─────────────────────────────────────────────────────────────────────────────
# SCRIPT: health-check.sh  —  Service health verification
# ─────────────────────────────────────────────────────────────────────────────

health_check() {
  log "Checking ALP Platform health..."

  # Backend API
  API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health)
  [ "$API_STATUS" = "200" ] && log "Backend API ✓" || warn "Backend API returned $API_STATUS"

  # Database
  DB_OK=$(docker compose -f 09-deployment/docker-compose.yml exec -T postgres pg_isready -U alp_user -d alp_db 2>&1)
  echo "$DB_OK" | grep -q "accepting" && log "PostgreSQL ✓" || warn "PostgreSQL: $DB_OK"

  # Redis
  REDIS_OK=$(docker compose -f 09-deployment/docker-compose.yml exec -T redis redis-cli ping 2>&1)
  [ "$REDIS_OK" = "PONG" ] && log "Redis ✓" || warn "Redis: $REDIS_OK"

  # Webapp
  WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
  [ "$WEB_STATUS" = "200" ] && log "Web App ✓" || warn "Web App returned $WEB_STATUS"

  log "Health check complete"
}


# ─────────────────────────────────────────────────────────────────────────────
# Makefile-style entrypoint
# ─────────────────────────────────────────────────────────────────────────────
case "${1:-help}" in
  setup)   setup_local ;;
  deploy)  deploy_production ;;
  ssl)     setup_ssl "$2" "$3" ;;
  backup)  backup_database ;;
  health)  health_check ;;
  *)
    echo ""
    echo -e "${PURPLE}ALP Platform Scripts — Built by Stan Paraclete${NC}"
    echo ""
    echo "Usage: ./scripts.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup    First-time local dev setup (DB + seed)"
    echo "  deploy   Build and deploy to production"
    echo "  ssl      Setup Let's Encrypt SSL (domain email)"
    echo "  backup   Backup database to S3"
    echo "  health   Check all service health"
    echo ""
    ;;
esac
