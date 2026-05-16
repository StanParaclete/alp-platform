# ALP Platform — What To Do Next
## Built by Stan Paraclete | www.stanparaclete.com | growwithalp.com

---

## YOUR PROJECT IS IN VS CODE — HERE IS EXACTLY WHAT TO RUN

### STEP 1 — Install Dependencies (run once)
Open Terminal in VS Code (`Ctrl+`` ` or `Cmd+`` `). Run each folder:

```bash
# Backend (Node.js API)
cd 05-backend
npm install

# Web App (React)
cd ../02-webapp
npm install

# Mobile App (React Native)
cd ../03-app
npm install

# Desktop App (Electron)
cd ../04-software
npm install
```

---

### STEP 2 — Set Up Database
```bash
cd 06-database

# Create a PostgreSQL database first (if not done)
# On Mac: brew install postgresql && brew services start postgresql
# On Windows: download from postgresql.org

# Run database migrations
cd ../05-backend
npx prisma migrate dev --name init

# Seed with demo data (Ms. Simmons + 6 students)
npx prisma db seed
```

---

### STEP 3 — Create Environment File
```bash
cd 05-backend
cp .env.example .env
```

Then open `.env` and fill in:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/alp_db"
JWT_SECRET="your-secret-key-here-make-it-long"
ANTHROPIC_API_KEY="your-claude-api-key-from-anthropic.com"
REDIS_URL="redis://localhost:6379"
```

---

### STEP 4 — Run the App (Development)

**Option A: Run everything with Docker (easiest)**
```bash
# From the ALP_COMPLETE folder root
cd 09-deployment
docker-compose up -d
```
Then open: **http://localhost:3000**

**Option B: Run manually (3 terminals)**

Terminal 1 — Backend:
```bash
cd 05-backend
npm run dev
# Runs on: http://localhost:4000
```

Terminal 2 — Web App:
```bash
cd 02-webapp
npm run dev
# Runs on: http://localhost:3000
```

Terminal 3 — Mobile (optional):
```bash
cd 03-app
npx expo start
# Scan QR code with Expo Go app on phone
```

---

### STEP 5 — Test Login
Open browser → **http://localhost:3000**

| Role | Email | Password |
|------|-------|----------|
| Teacher | ms.simmons@westwood.edu | ALPDemo2026! |
| Admin | school.admin@westwood.edu | ALPDemo2026! |
| Parent | parent@demo.com | ALPDemo2026! |

---

### STEP 6 — Add Your Assets (Images & Videos)

**Your ALP Logo** (`ALP.png`):
```bash
# Copy your logo to all the right places
cp /path/to/ALP.png 02-webapp/public/favicon.png
cp /path/to/ALP.png 02-webapp/public/icons/icon-192.png
cp /path/to/ALP.png 03-app/assets/icon.png
cp /path/to/ALP.png 04-software/assets/icon.png
```

**Hero Images** — Download free from:
- https://unsplash.com/s/photos/special-education-classroom
- https://unsplash.com/s/photos/teacher-student-africa
- Download 3 images → save to `00-assets/images/hero/`

**Demo Video** — Record your screen:
- Mac: `Cmd+Shift+5` → Record Screen
- Windows: `Win+G` → Xbox Game Bar
- Save to `00-assets/videos/demo/alp-demo.mp4`

**Tutorial Videos** (record 5 short videos):
1. Getting started (5 min)
2. AI goal generation (3 min)
3. Progress monitoring (4 min)
4. Family portal (3 min)
5. Exporting ALP PDF (2 min)

---

### STEP 7 — Deploy to Production

**Deploy backend to Railway.app (free tier):**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Deploy web app to Vercel (free):**
```bash
npm install -g vercel
cd 02-webapp
vercel --prod
```

**Your domains:**
- Web App: **app.growwithalp.com** → point to Vercel
- Backend API: **api.growwithalp.com** → point to Railway

---

### STEP 8 — Run Tests
```bash
cd 05-backend
npm test
# Runs 30 tests — all should pass
```

---

## WHAT IS ALREADY COMPLETE ✅

- [x] Complete React Web App (1,278 lines) — all 16 prototype screens
- [x] Full backend API (39 files) — auth, students, ALP, goals, progress, AI, family, reports
- [x] PostgreSQL database schema (20 models)
- [x] Demo seed data (Ms. Simmons + 6 students + full ALP)
- [x] React Native mobile app (iOS + Android)
- [x] Electron desktop app (Windows + macOS + Linux)
- [x] Background job worker (review alerts, progress monitoring)
- [x] PWA service worker (offline support)
- [x] Docker + nginx deployment config
- [x] GitHub Actions CI/CD pipeline
- [x] 30-test Jest test suite
- [x] OpenAPI documentation
- [x] Global compliance (IDEA, GES Ghana, UK SEND, Nigeria, Kenya, etc.)

## WHAT YOU NEED TO ADD 📋

- [ ] Your real images (hero photos, app screenshots)
- [ ] Your demo video (screen recording of the app)
- [ ] Tutorial videos (5 short how-to videos)
- [ ] Your domain DNS records (growwithalp.com)
- [ ] Your Anthropic API key (for AI goals)
- [ ] Your Stripe keys (for billing)
- [ ] Your email provider (Resend or SendGrid)
- [ ] SSL certificate (automatic with Railway/Vercel)

---

## COST TO RUN

| Service | Cost | What For |
|---------|------|---------|
| Railway (backend) | $5/month | Node.js API server |
| Vercel (web app) | Free | React web app |
| Railway (database) | $5/month | PostgreSQL |
| Railway (Redis) | $2/month | Cache + jobs |
| Anthropic API | ~$10/month | Claude AI goals |
| Total | **~$22/month** | Full production stack |

---

*Built by Stan Paraclete · www.stanparaclete.com · ALP Platform v2.4.1*
