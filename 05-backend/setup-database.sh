#!/bin/bash
# ═══════════════════════════════════════════════════════════
# ALP Platform — Database Setup Script
# Run this ONCE to set up your Railway database
# Built by Stan Paraclete · www.stanparaclete.com
# ═══════════════════════════════════════════════════════════

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ALP Platform — Database Setup      ║${NC}"
echo -e "${BLUE}║   growwithalp.com                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Check we're in the right place ─────────────────────────
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Run this from the 05-backend folder${NC}"
  echo "   cd ~/Downloads/ALP_COMPLETE/05-backend"
  exit 1
fi

# ── Get DATABASE_URL ────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}Paste your Railway DATABASE_URL below and press Enter:${NC}"
  echo -e "${YELLOW}(Find it: Railway → PostgreSQL → Connect tab)${NC}"
  echo ""
  read -p "DATABASE_URL: " DATABASE_URL
  echo ""
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ No DATABASE_URL provided. Exiting.${NC}"
  exit 1
fi

export DATABASE_URL

echo -e "${GREEN}→ DATABASE_URL received ✓${NC}"
echo ""

# ── Step 1: Generate Prisma Client ─────────────────────────
echo -e "${YELLOW}[1/3] Generating Prisma client...${NC}"
npx prisma generate --schema=prisma/schema.prisma
echo -e "${GREEN}✅ Prisma client generated${NC}"
echo ""

# ── Step 2: Push schema to database ────────────────────────
echo -e "${YELLOW}[2/3] Creating database tables...${NC}"
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss
echo -e "${GREEN}✅ Database tables created${NC}"
echo ""

# ── Step 3: Seed demo data ──────────────────────────────────
echo -e "${YELLOW}[3/3] Seeding demo data...${NC}"
node prisma/seed.js
echo -e "${GREEN}✅ Demo data seeded${NC}"
echo ""

echo -e "${BLUE}══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 DATABASE SETUP COMPLETE!${NC}"
echo ""
echo -e "Demo login credentials:"
echo -e "  Email:    ms.simmons@westwood.edu"
echo -e "  Password: ALPDemo2026!"
echo ""
echo -e "Also try all 7 roles:"
echo -e "  admin@growwithalp.com        → Administrator"
echo -e "  principal@westwood.edu       → School Leadership"
echo -e "  intervention@westwood.edu    → Intervention Specialist"
echo -e "  ms.rivera@westwood.edu       → Related Services"
echo -e "  parent@demo.com              → Family"
echo -e "  All passwords: ALPDemo2026!"
echo -e "${BLUE}══════════════════════════════════════${NC}"
echo ""
