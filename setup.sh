#!/bin/bash
# ═══════════════════════════════════════════════════════════
# ALP Platform — One-Click Mac Setup Script
# Built by Stan Paraclete | www.stanparaclete.com
# Run this from the ALP_COMPLETE folder:
#   chmod +x setup.sh && ./setup.sh
# ═══════════════════════════════════════════════════════════

set -e  # stop on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "═══════════════════════════════════════════════"
echo "  ALP Platform — Setup"
echo "  Built by Stan Paraclete"
echo "═══════════════════════════════════════════════"
echo ""

# ─── CHECK NODE VERSION ────────────────────────────────────
echo -e "${BLUE}[1/6] Checking Node.js version...${NC}"
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)

if [ -z "$NODE_VERSION" ]; then
  echo -e "${RED}❌ Node.js not found. Installing via Homebrew...${NC}"
  if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  brew install node@20
  echo -e "${GREEN}✅ Node.js 20 installed${NC}"
elif [ "$NODE_VERSION" -lt "18" ]; then
  echo -e "${RED}❌ Node.js v$NODE_VERSION is too old. Need v18 or higher.${NC}"
  echo ""
  echo "Run this to upgrade:"
  echo "  brew install node@20"
  echo "  or visit: https://nodejs.org → download LTS"
  echo ""
  echo "After upgrading, run this script again."
  exit 1
else
  echo -e "${GREEN}✅ Node.js v$(node -v) — OK${NC}"
fi

# ─── CHECK POSTGRESQL ──────────────────────────────────────
echo -e "${BLUE}[2/6] Checking PostgreSQL...${NC}"
if ! command -v psql &>/dev/null; then
  echo -e "${YELLOW}⚠️  PostgreSQL not found. Installing...${NC}"
  brew install postgresql@15
  brew services start postgresql@15
  echo -e "${GREEN}✅ PostgreSQL installed and started${NC}"
else
  echo -e "${GREEN}✅ PostgreSQL found${NC}"
  # Make sure it's running
  brew services start postgresql@15 2>/dev/null || pg_ctl start 2>/dev/null || true
fi

# Create the database
echo "   Creating database 'alp_db'..."
createdb alp_db 2>/dev/null && echo -e "${GREEN}   ✅ Database 'alp_db' created${NC}" || echo -e "${YELLOW}   ℹ️  Database may already exist — continuing${NC}"

# ─── INSTALL BACKEND ──────────────────────────────────────
echo -e "${BLUE}[3/6] Installing backend dependencies...${NC}"
cd 05-backend
npm install --legacy-peer-deps
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

# ─── SET UP .ENV ──────────────────────────────────────────
echo -e "${BLUE}[4/6] Setting up environment file...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || cat > .env << 'ENVEOF'
# ALP Platform Environment Variables
# Edit these values before running in production

DATABASE_URL="postgresql://postgres@localhost:5432/alp_db"
JWT_SECRET="alp-super-secret-jwt-key-change-in-production-2026"
JWT_REFRESH_SECRET="alp-refresh-secret-key-change-in-production-2026"
PORT=4000
NODE_ENV=development

# Get your key from: https://console.anthropic.com
ANTHROPIC_API_KEY="your-anthropic-api-key-here"

# Redis (optional for development - app works without it)
REDIS_URL="redis://localhost:6379"

# App URLs
APP_URL="http://localhost:3000"
API_URL="http://localhost:4000"

# Email (optional for development)
EMAIL_FROM="noreply@growwithalp.com"
ENVEOF
  echo -e "${GREEN}✅ .env file created${NC}"
  echo -e "${YELLOW}   ⚠️  Open 05-backend/.env and add your ANTHROPIC_API_KEY${NC}"
else
  echo -e "${GREEN}✅ .env already exists${NC}"
fi

# ─── DATABASE SETUP ───────────────────────────────────────
echo -e "${BLUE}[5/6] Setting up database...${NC}"

# Generate Prisma client
npx prisma generate --schema=../06-database/schema.prisma 2>/dev/null || true

# Push schema to database (creates tables)
npx prisma db push --schema=../06-database/schema.prisma --accept-data-loss 2>/dev/null && \
  echo -e "${GREEN}✅ Database tables created${NC}" || \
  echo -e "${YELLOW}⚠️  Database setup skipped — you can do this manually later${NC}"

cd ..

# ─── INSTALL WEBAPP ───────────────────────────────────────
echo -e "${BLUE}[6/6] Installing web app dependencies...${NC}"
cd 02-webapp
npm install
echo -e "${GREEN}✅ Web app dependencies installed${NC}"
cd ..

# ─── DONE ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo -e "${GREEN}  ✅ ALP Platform setup complete!${NC}"
echo "═══════════════════════════════════════════════"
echo ""
echo "To start the app, open 2 Terminal tabs:"
echo ""
echo -e "  ${YELLOW}Terminal 1 (Backend API):${NC}"
echo "    cd 05-backend && npm run dev"
echo ""
echo -e "  ${YELLOW}Terminal 2 (Web App):${NC}"
echo "    cd 02-webapp && npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Login credentials:"
echo "  Email:    ms.simmons@westwood.edu"
echo "  Password: ALPDemo2026!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Built by Stan Paraclete"
echo "  www.stanparaclete.com | growwithalp.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
