# ALP Platform — Accelerated Learning Plan
### Built by Stan Paraclete | [www.stanparaclete.com](https://www.stanparaclete.com)

> A complete, production-ready educational intervention platform supporting schools, learning centers, governments, NGOs, and private institutions globally. Designed to help educators plan, track, and accelerate growth for every learner.

---

## 🌍 Platform Overview

ALP is a modern private education intervention platform inspired by IEP systems but redesigned for global use across Africa, Asia, Europe, the Middle East, and worldwide.

**Live Domain:** `growwithalp.com`  
**App Subdomain:** `app.growwithalp.com`  
**Version:** 2.4.1  
**License:** Proprietary — Stan Paraclete

---

## 📁 Project Structure

```
ALP_COMPLETE/
├── 01-website/          # Next.js marketing website (growwithalp.com)
├── 02-webapp/           # React + Vite web application (app.growwithalp.com)
├── 03-app/              # React Native + Expo mobile app (iOS + Android)
├── 04-software/         # Electron desktop app (Windows, Mac, Linux)
├── 05-backend/          # Node.js + Express API server
├── 06-database/         # PostgreSQL + Prisma schema + migrations + seeds
├── 07-assets/           # Brand assets, icons, images
├── 08-docs/             # Documentation
└── 09-deployment/       # Docker, Nginx, CI/CD configs
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker + Docker Compose (recommended)

### Option A: Docker (Recommended for Production)

```bash
# 1. Clone and configure
git clone https://github.com/stanparaclete/alp-platform.git
cd ALP_COMPLETE

# 2. Set environment variables
cp 05-backend/.env.example 05-backend/.env
# Edit .env with your values

# 3. Start all services
cd 09-deployment
docker compose up -d

# 4. Run migrations and seed
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed

# 5. Visit the platform
open https://growwithalp.com
```

### Option B: Local Development

```bash
# Terminal 1: Backend
cd 05-backend
npm install
cp .env.example .env    # Fill in your values
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev             # Starts on :4000

# Terminal 2: Web App
cd 02-webapp
npm install
npm run dev             # Starts on :3000

# Terminal 3: Mobile App (optional)
cd 03-app
npm install
npx expo start          # Scan QR with Expo Go

# Terminal 4: Desktop App (optional)
cd 04-software
npm install
npm run electron:dev
```

---

## 🏗 Architecture

```
                    ┌─────────────────────────────────────┐
                    │         CloudFront CDN               │
                    │      cdn.growwithalp.com             │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │         Nginx Reverse Proxy          │
                    │    growwithalp.com / app.*           │
                    └────┬──────────────────────┬─────────┘
                         │                      │
          ┌──────────────▼──────┐    ┌──────────▼──────────┐
          │   Next.js Website   │    │   React Web App      │
          │  growwithalp.com    │    │  app.growwithalp.com │
          │     Port 3000       │    │     Port 3000        │
          └─────────────────────┘    └──────────┬──────────┘
                                                │
                    ┌───────────────────────────▼─────────┐
                    │      Express API Server              │
                    │      api.growwithalp.com             │
                    │         Port 4000                    │
                    └─────┬────────────┬──────────────────┘
                          │            │
          ┌───────────────▼──┐    ┌────▼──────────────┐
          │   PostgreSQL 16   │    │    Redis 7         │
          │   Primary DB      │    │  Cache + Sessions  │
          │    Port 5432      │    │    Port 6379       │
          └──────────────────┘    └───────────────────┘
                          │
          ┌───────────────▼──────────────────────────┐
          │           AWS S3 (File Storage)           │
          │    Documents, PDFs, Profile Photos        │
          └──────────────────────────────────────────┘
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@growwithalp.com | ALPDemo2026! |
| Special Ed Teacher | ms.simmons@westwood.edu | ALPDemo2026! |
| School Admin | school.admin@westwood.edu | ALPDemo2026! |
| Parent | parent@demo.com | ALPDemo2026! |

---

## 📱 Platform Access

| Platform | URL / Download | Description |
|----------|---------------|-------------|
| Website | growwithalp.com | Marketing + conversion |
| Web App | app.growwithalp.com | Full browser application |
| iOS App | App Store → ALP Platform | Native mobile (Expo) |
| Android App | Play Store → ALP Platform | Native mobile (Expo) |
| Windows | growwithalp.com/download | Desktop app (.exe) |
| macOS | growwithalp.com/download | Desktop app (.dmg) |
| Linux | growwithalp.com/download | Desktop app (.deb/.AppImage) |

---

## 🌐 Supported Compliance Frameworks

| Region | Framework | Status |
|--------|-----------|--------|
| USA | IDEA, Section 504 | ✅ Full |
| Virginia | VDOE SOL | ✅ Full |
| Ghana | GES / SPED | ✅ Full |
| Nigeria | NERDC / UBEC | ✅ Full |
| Kenya | KICD | ✅ Full |
| South Africa | WCED / White Paper 6 | ✅ Full |
| United Kingdom | SEND Code of Practice | ✅ Full |
| Canada | Provincial IEP | ✅ Full |
| Australia | NCCD / DDA | ✅ Full |
| Custom | Configurable | ✅ Full |

---

## 🤖 AI Features (Claude-Powered)

- **Goal Suggestions** — SMART annual goals from student profile + baseline
- **Accommodation Recommendations** — Based on disability category and learning profile
- **Narrative Generation** — Professional, family-friendly, student-facing tones
- **Progress Risk Prediction** — Early warning when students fall off trajectory
- **Intervention Suggestions** — Evidence-based strategies by domain
- **Parent-Friendly Summaries** — Plain-language ALP summaries for families

---

## 👥 Supported User Roles

| Role | Access Level |
|------|-------------|
| Super Admin | Full platform access across all districts |
| District Manager | All schools within district |
| School Admin | Full access within school |
| Special Ed Teacher | Own caseload + ALP builder |
| Teacher | View/add progress for assigned students |
| Therapist | Session notes + goals in specialty area |
| Psychologist | Evaluations + assessments |
| Parent | Family portal only (own child) |
| Student | Student-facing portal |

---

## 🏫 Supported Learner Categories

Autism · ADHD · Dyslexia · Dyscalculia · Speech/Language · Hearing Impairment · Visual Impairment · Behavioral/Emotional · Gifted · Multiple Disabilities · Developmental Delay · Early Childhood · ELL · Twice Exceptional (2E) · Physical Disability · Trauma-Informed · Health Impairment · Intellectual Disability · Custom Categories

---

## 📋 ALP Builder — 13 Sections

1. Student Information
2. Present Levels of Performance
3. Strengths & Learning Profile
4. Educational Needs
5. Measurable Annual Goals
6. Special Education Services
7. Accommodations & Modifications
8. Intervention Plan
9. Future Readiness & Transition
10. Behavior Supports (BIP)
11. Family Input & Rights
12. Review Summary
13. Create ALP Document

**Each section includes:** Autosave · AI suggestions · Validation · Completion tracking · Draft recovery · Collaboration · Comments · Version history · E-signatures

---

## 📊 Reports

- ALP Report (per student)
- Family Progress Report
- Student Growth Report
- Intervention Effectiveness Report
- School-Level Compliance Report
- District Summary Report
- Audit Trail Report
- Reevaluation Schedule

**Export formats:** PDF · Word (.docx) · Print · Email to family

---

## 🚀 Deployment Options

### Vercel (Website + Web App)
```bash
# 01-website
cd 01-website && vercel deploy --prod

# 02-webapp
cd 02-webapp && vercel deploy --prod
```

### Railway (Backend + DB)
```bash
cd 05-backend
railway login
railway init
railway add postgresql redis
railway deploy
```

### Netlify (Website)
```bash
# netlify.toml already included in 01-website/
cd 01-website && netlify deploy --prod
```

### Docker (Self-hosted)
```bash
cd 09-deployment
docker compose --env-file ../.env up -d
```

---

## 📱 Mobile Build

```bash
cd 03-app

# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 🖥 Desktop Build

```bash
cd 04-software

# Windows
npm run build:win        # → dist/ALP-Setup-2.4.1.exe

# macOS
npm run build:mac        # → dist/ALP-2.4.1.dmg

# Linux
npm run build:linux      # → dist/ALP-2.4.1.AppImage
                         #   dist/alp_2.4.1_amd64.deb
```

---

## 🔒 Security

- JWT access tokens (15 min) + refresh tokens (7 days)
- Bcrypt password hashing (12 rounds)
- Rate limiting on all endpoints
- Account lockout after 5 failed attempts
- TOTP 2FA support
- HTTPS enforced everywhere
- CORS whitelist
- Helmet.js security headers
- HSTS with preload
- Audit logs for all data changes
- Input validation with Zod
- Parameterized queries (Prisma)
- File type validation on uploads
- Signed S3 URLs (15-minute expiry)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Website | Next.js 14 + Tailwind + Framer Motion |
| Web App | React 18 + Vite + Zustand + React Router |
| Mobile | React Native + Expo SDK 51 |
| Desktop | Electron 30 |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache | Redis 7 |
| AI | Anthropic Claude (claude-sonnet-4) |
| Auth | JWT + bcrypt + TOTP |
| Storage | AWS S3 + CloudFront |
| Email | SendGrid |
| Charts | Recharts (web) + Victory Native (mobile) |
| PDF | PDFKit + pdf-lib |
| Payments | Stripe |
| Monitoring | Sentry |
| CI/CD | GitHub Actions |
| Hosting | Railway (backend) + Vercel (frontend) |
| CDN | AWS CloudFront |

---

## 📞 Support & Contact

- **Platform:** [growwithalp.com](https://growwithalp.com)
- **Documentation:** [docs.growwithalp.com](https://docs.growwithalp.com)
- **Support:** support@growwithalp.com
- **Builder:** [Stan Paraclete](https://www.stanparaclete.com)

---

*Built by Stan Paraclete | www.stanparaclete.com*  
*ALP Platform v2.4.1 · Supporting Every Learner's Growth*
