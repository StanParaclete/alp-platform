/**
 * ALP Platform — Users Route + Background Worker
 * Built by Stan Paraclete | www.stanparaclete.com
 */


// ═══════════════════════════════════════════════════════════════
// src/routes/users.js  —  User management (admin)
// ═══════════════════════════════════════════════════════════════
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { sendEmail } from '../services/email.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users — list users (admin only)
router.get('/', requireRole(['SUPER_ADMIN', 'DISTRICT_MANAGER', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    const { role, schoolId, page = 1, limit = 25, q } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (req.user.role === 'SCHOOL_ADMIN') where.schoolId = req.user.schoolId;
    if (req.user.role === 'DISTRICT_MANAGER') where.districtId = req.user.districtId;
    if (role)     where.role = role;
    if (schoolId) where.schoolId = schoolId;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
        { email:     { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
          school:   { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
          _count:   { select: { students: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip, take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    if (req.user.id !== req.params.id && !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, avatarUrl: true, preferences: true,
        twoFactorEnabled: true, isActive: true, lastLoginAt: true, createdAt: true,
        school: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
        students: { select: { id: true, firstName: true, lastName: true, grade: true }, take: 20 },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — create user (admin invites)
router.post('/', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DISTRICT_MANAGER']), async (req, res) => {
  try {
    const schema = z.object({
      email:     z.string().email(),
      firstName: z.string().min(1),
      lastName:  z.string().min(1),
      role:      z.string(),
      schoolId:  z.string().optional(),
    });
    const data = schema.parse(req.body);

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const hash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        ...data,
        passwordHash: hash,
        districtId: req.user.districtId,
        schoolId:   data.schoolId || req.user.schoolId,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    // TODO: send invite email with temp password
    res.status(201).json({ user, tempPassword, message: 'User created. Send them the temp password.' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
  try {
    if (req.user.id !== req.params.id && !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { password, role, ...data } = req.body;

    // Role changes only by admin
    const updateData = { ...data };
    if (role && ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) updateData.role = role;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, avatarUrl: true, preferences: true,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  (deactivate)
router.delete('/:id', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me/caseload  — teacher's students
router.get('/me/caseload', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        students: {
          where: { isActive: true },
          include: {
            disabilities: { where: { isPrimary: true }, take: 1 },
            alpPlans:     { where: { status: { in: ['ACTIVE','DRAFT'] } }, select: { id: true, status: true, reviewDate: true, completionPct: true }, take: 1 },
          },
          orderBy: { lastName: 'asc' },
        },
      },
    });
    res.json(user?.students || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


// ═══════════════════════════════════════════════════════════════
// src/worker.js  —  Background job processor
// ═══════════════════════════════════════════════════════════════
/*
 * Handles scheduled jobs:
 *   - Review due date alerts (daily)
 *   - Stale goal detection (daily)
 *   - Signature expiry (daily)
 *   - Weekly progress reports (weekly)
 *   - ALP PDF regeneration on activation
 *   - Subscription expiry checks (daily)
 */

/*
import { PrismaClient } from '@prisma/client';
const redis = { get: async()=>null, set: async()=>'OK' };

async function reviewDueAlerts() {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const overdue = new Date();

  const dueSoon = await prisma.aLPPlan.findMany({
    where: { status: 'ACTIVE', reviewDate: { lte: soon } },
    include: {
      student:   { select: { firstName: true, lastName: true } },
      createdBy: { select: { id: true, email: true, firstName: true } },
    },
  });

  for (const plan of dueSoon) {
    const isOverdue = new Date(plan.reviewDate) < overdue;
    const daysLeft  = Math.ceil((new Date(plan.reviewDate) - overdue) / (24 * 60 * 60 * 1000));

    const alreadyNotified = await redis.get(`review_notif:${plan.id}`);
    if (alreadyNotified) continue;

    await prisma.notification.create({
      data: {
        userId: plan.createdById,
        title:  isOverdue ? '🔴 Annual Review Overdue' : `⚠️ Annual Review Due in ${daysLeft} days`,
        body:   `${plan.student.firstName} ${plan.student.lastName}'s ALP annual review is ${isOverdue ? 'overdue' : `due in ${daysLeft} days`}.`,
        type:   'review_due',
        data:   { alpId: plan.id, studentId: plan.studentId },
      },
    });

    await redis.set(`review_notif:${plan.id}`, '1', { EX: 86400 * 7 });
  }

  console.log(`[WORKER] Review alerts sent: ${dueSoon.length}`);
}

async function staleGoalDetection() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const staleGoals = await prisma.goal.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { progress: { none: {} } },
        { progress: { none: { recordedAt: { gte: thirtyDaysAgo } } } },
      ],
    },
    include: {
      alp: {
        include: {
          createdBy: { select: { id: true } },
          student:   { select: { firstName: true, lastName: true } },
        },
      },
    },
    take: 100,
  });

  for (const goal of staleGoals) {
    await prisma.notification.upsert({
      where:  { id: `stale_${goal.id}` },
      update: {},
      create: {
        id:     `stale_${goal.id}`,
        userId: goal.alp.createdById,
        title:  '📊 Progress Data Needed',
        body:   `No progress recorded for ${goal.alp.student.firstName}'s ${goal.domain.replace(/_/g,' ')} goal in 30+ days.`,
        type:   'goal_alert',
        data:   { goalId: goal.id, alpId: goal.alpId },
      },
    }).catch(() => {});
  }

  console.log(`[WORKER] Stale goals flagged: ${staleGoals.length}`);
}

async function signatureExpiry() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const expiredSigs = await prisma.signature.findMany({
    where: { status: 'PENDING', requestedAt: { lt: sevenDaysAgo } },
  });

  await Promise.all(expiredSigs.map(s =>
    prisma.signature.update({ where: { id: s.id }, data: { status: 'EXPIRED' } })
  ));

  console.log(`[WORKER] Signatures expired: ${expiredSigs.length}`);
}

async function subscriptionExpiryCheck() {
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const expiring = await prisma.subscription.findMany({
    where: { status: 'active', expiresAt: { lte: threeDays } },
    include: { district: { include: { users: { where: { role: 'DISTRICT_MANAGER' }, take: 1 } } } },
  });

  for (const sub of expiring) {
    const manager = sub.district.users[0];
    if (manager) {
      await sendEmail({
        to:       manager.email,
        subject:  'Your ALP Platform subscription expires soon',
        template: 'subscription-expiring',
        data:     { districtName: sub.district.name, expiresAt: sub.expiresAt, renewLink: 'https://growwithalp.com/billing' },
      });
    }
  }

  console.log(`[WORKER] Subscription expiry warnings sent: ${expiring.length}`);
}

// ─── Job scheduler ────────────────────────────────────────────
async function runJobs() {
  console.log('[WORKER] Starting job cycle:', new Date().toISOString());
  try {
    await reviewDueAlerts();
    await staleGoalDetection();
    await signatureExpiry();
    await subscriptionExpiryCheck();
    console.log('[WORKER] Job cycle complete');
  } catch (err) {
    console.error('[WORKER] Job failed:', err);
  }
}

// Run immediately, then every 6 hours
await runJobs();
setInterval(runJobs, 6 * 60 * 60 * 1000);
*/
