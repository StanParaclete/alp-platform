/**
 * ALP Platform — Backend API Server
 * Node.js + Express + PostgreSQL + Prisma
 * Built by Stan Paraclete | www.stanparaclete.com
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { prisma } from './db.js';

// Re-export prisma for routes that import from index
export { prisma };

// Routes
import authRoutes     from './routes/auth.js';
import userRoutes     from './routes/users.js';
import studentRoutes  from './routes/students.js';
import alpRoutes      from './routes/alp.js';
import goalRoutes     from './routes/goals.js';
import progressRoutes from './routes/progress.js';
import familyRoutes   from './routes/family.js';
import aiRoutes       from './routes/ai.js';
import { reportsRouter, notifRouter, schoolsRouter, documentsRouter, complianceRouter } from './routes/split-routes.js';

// Middleware
import { authenticate } from './middleware/auth.js';

const app  = express();
const PORT = process.env.PORT || 4000;

// Connect DB
prisma.$connect()
  .then(() => console.log('✅ Database connected'))
  .catch((e) => console.warn('⚠️  Database not connected (demo mode):', e.message));

// Core middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://app.growwithalp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

// Health check
app.get('/health', async (req, res) => {
  let dbOk = false;
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch {}
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '2.4.1', db: dbOk ? 'connected' : 'demo-mode' });
});

// Routes
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/users',         authenticate, userRoutes);
app.use('/api/students',      authenticate, studentRoutes);
app.use('/api/alp',           authenticate, alpRoutes);
app.use('/api/goals',         authenticate, goalRoutes);
app.use('/api/progress',      authenticate, progressRoutes);
app.use('/api/family',        authenticate, familyRoutes);
app.use('/api/ai',            authenticate, aiRoutes);
app.use('/api/reports',       authenticate, reportsRouter);
app.use('/api/notifications', authenticate, notifRouter);
app.use('/api/schools',       authenticate, schoolsRouter);
app.use('/api/documents',     authenticate, documentsRouter);
app.use('/api/compliance',    complianceRouter);

// 404
app.use('*', (req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   ALP Platform API — v2.4.1              ║
  ║   http://localhost:${PORT}                  ║
  ║   Built by Stan Paraclete                ║
  ║   www.stanparaclete.com                  ║
  ╚══════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

export default app;
