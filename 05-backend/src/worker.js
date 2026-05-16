/**
 * ALP Platform — Background Job Worker
 * Scheduled tasks: review alerts, stale goals, signature expiry,
 * weekly reports, subscription checks, progress risk detection
 * Built by Stan Paraclete | www.stanparaclete.com
 *
 * Run independently: node src/worker.js
 * Or via docker compose as the 'worker' service
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { sendEmail } from './services/email.js';

const prisma = new PrismaClient({ log: ['error'] });
const redis  = createClient({ url: process.env.REDIS_URL });

await redis.connect();
console.log('[WORKER] Connected to Redis');

// ─── Job: Annual Review Due Alerts ────────────────────────────────────────────
async function reviewDueAlerts() {
  const now      = new Date();
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const in7days  = new Date(Date.now() +  7 * 24 * 60 * 60 * 1000);

  const plans = await prisma.aLPPlan.findMany({
    where:   { status: 'ACTIVE', reviewDate: { lte: in30days } },
    include: {
      student:   { select: { firstName: true, lastName: true } },
      createdBy: { select: { id: true, email: true, firstName: true } },
    },
  });

  let notified = 0;
  for (const plan of plans) {
    const cacheKey = `review_alert:${plan.id}`;
    const already  = await redis.get(cacheKey);
    if (already) continue;

    const reviewDate = new Date(plan.reviewDate);
    const isOverdue  = reviewDate < now;
    const daysLeft   = Math.ceil((reviewDate - now) / (24 * 60 * 60 * 1000));
    const isUrgent   = reviewDate <= in7days;

    await prisma.notification.create({
      data: {
        userId: plan.createdById,
        title:  isOverdue ? '🔴 Annual Review Overdue'
               : isUrgent ? `⚠️ Review Due in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`
               :            `📅 Annual Review Approaching`,
        body: `${plan.student.firstName} ${plan.student.lastName}'s ALP annual review is ${
          isOverdue ? `overdue by ${Math.abs(daysLeft)} days` : `due in ${daysLeft} days`}.`,
        type: 'review_due',
        data: { alpId: plan.id, studentId: plan.studentId, daysLeft, isOverdue },
      },
    });

    // Email for urgent/overdue
    if (isUrgent || isOverdue) {
      await sendEmail({
        to:       plan.createdBy.email,
        subject:  `Action Required: ${plan.student.firstName}'s ALP Review`,
        template: 'review-due',
        data: {
          teacherName:  plan.createdBy.firstName,
          studentName:  `${plan.student.firstName} ${plan.student.lastName}`,
          reviewDate:   reviewDate.toLocaleDateString(),
          isOverdue,
          daysLeft:     Math.abs(daysLeft),
          portalLink:   `${process.env.APP_URL}/builder/${plan.id}`,
        },
      });
    }

    // Cache so we don't spam (7 days)
    await redis.set(cacheKey, '1', { EX: 60 * 60 * 24 * 7 });
    notified++;
  }

  return notified;
}

// ─── Job: Stale Goal Detection ────────────────────────────────────────────────
async function staleGoalDetection() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Goals with no progress data in 30+ days
  const staleGoals = await prisma.goal.findMany({
    where: {
      status: 'ACTIVE',
      alp:    { status: 'ACTIVE' },
      OR: [
        { progress: { none: {} } },
        { progress: { every: { recordedAt: { lt: thirtyDaysAgo } } } },
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
    take: 200,
  });

  let flagged = 0;
  for (const goal of staleGoals) {
    const cacheKey = `stale_goal:${goal.id}`;
    if (await redis.get(cacheKey)) continue;

    await prisma.notification.create({
      data: {
        userId: goal.alp.createdById,
        title:  '📊 Progress Data Needed',
        body:   `No progress recorded for ${goal.alp.student.firstName} ${goal.alp.student.lastName}'s ${
          goal.domain.replace(/_/g, ' ')} goal in 30+ days.`,
        type:   'stale_goal',
        data:   { goalId: goal.id, alpId: goal.alpId },
      },
    }).catch(() => {});

    await redis.set(cacheKey, '1', { EX: 60 * 60 * 24 * 14 }); // 14 days
    flagged++;
  }

  return flagged;
}

// ─── Job: Signature Expiry ────────────────────────────────────────────────────
async function signatureExpiry() {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.signature.updateMany({
    where: { status: 'PENDING', requestedAt: { lt: fourteenDaysAgo } },
    data:  { status: 'EXPIRED' },
  });

  return count;
}

// ─── Job: Progress Risk Detection ────────────────────────────────────────────
async function progressRiskDetection() {
  // Find students with at least 4 data points showing downward trend
  const activeGoals = await prisma.goal.findMany({
    where: { status: 'ACTIVE', alp: { status: 'ACTIVE' } },
    include: {
      progress: { orderBy: { recordedAt: 'desc' }, take: 6 },
      alp: {
        include: {
          createdBy: { select: { id: true } },
          student:   { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  let risksDetected = 0;
  for (const goal of activeGoals) {
    if (goal.progress.length < 4) continue;

    // Calculate trend from last 4 points
    const recent = goal.progress.slice(0, 4).reverse(); // oldest first
    const slope  = (recent[3].value - recent[0].value) / 3;

    if (slope < -2) { // declining more than 2 units per interval
      const cacheKey = `risk_alert:${goal.id}`;
      if (await redis.get(cacheKey)) continue;

      await prisma.notification.create({
        data: {
          userId: goal.alp.createdById,
          title:  '⚠️ Goal At Risk',
          body:   `${goal.alp.student.firstName} ${goal.alp.student.lastName}'s ${
            goal.domain.replace(/_/g, ' ')} goal is declining. Intervention may be needed.`,
          type:   'goal_risk',
          data:   { goalId: goal.id, alpId: goal.alpId, slope },
        },
      }).catch(() => {});

      await redis.set(cacheKey, '1', { EX: 60 * 60 * 24 * 7 });
      risksDetected++;
    }
  }

  return risksDetected;
}

// ─── Job: Subscription Expiry Warnings ───────────────────────────────────────
async function subscriptionExpiryCheck() {
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const expiring = await prisma.subscription.findMany({
    where:   { status: 'active', expiresAt: { lte: in7days, gte: new Date() } },
    include: {
      district: {
        include: {
          users: { where: { role: { in: ['SUPER_ADMIN','DISTRICT_MANAGER'] } }, take: 2 },
        },
      },
    },
  });

  let warned = 0;
  for (const sub of expiring) {
    const cacheKey = `sub_expiry:${sub.id}`;
    if (await redis.get(cacheKey)) continue;

    const daysLeft = Math.ceil((new Date(sub.expiresAt) - new Date()) / (24 * 60 * 60 * 1000));

    for (const user of sub.district.users) {
      await sendEmail({
        to:       user.email,
        subject:  `Your ALP Platform subscription expires in ${daysLeft} days`,
        template: 'subscription-expiring',
        data: {
          name:         user.firstName,
          districtName: sub.district.name,
          plan:         sub.plan,
          expiresAt:    new Date(sub.expiresAt).toLocaleDateString(),
          renewLink:    `${process.env.APP_URL}/settings?tab=billing`,
        },
      }).catch(() => {});
    }

    await redis.set(cacheKey, '1', { EX: 60 * 60 * 24 * 3 });
    warned++;
  }

  return warned;
}

// ─── Job: Weekly Progress Digest (sent every Monday) ─────────────────────────
async function weeklyProgressDigest() {
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek !== 1) return 0; // Only run on Mondays

  const teachers = await prisma.user.findMany({
    where: { role: { in: ['TEACHER', 'SPECIAL_ED_TEACHER'] }, isActive: true },
    include: {
      students: {
        where: { isActive: true },
        include: {
          alpPlans: {
            where: { status: 'ACTIVE' },
            include: { goals: { include: { progress: { orderBy: { recordedAt: 'desc' }, take: 1 } } } },
            take: 1,
          },
        },
        take: 30,
      },
    },
  });

  let sent = 0;
  for (const teacher of teachers) {
    if (!teacher.students.length) continue;

    const atRisk = teacher.students.filter(s =>
      s.alpPlans[0]?.goals.some(g => !g.progress.length ||
        (g.progress[0] && new Date() - new Date(g.progress[0].recordedAt) > 30 * 24 * 60 * 60 * 1000))
    );

    await sendEmail({
      to:       teacher.email,
      subject:  `📊 Weekly ALP Progress Digest — ${new Date().toLocaleDateString()}`,
      template: 'weekly-digest',
      data: {
        teacherName:     teacher.firstName,
        totalStudents:   teacher.students.length,
        atRiskCount:     atRisk.length,
        atRiskStudents:  atRisk.map(s => `${s.firstName} ${s.lastName}`).slice(0, 5),
        portalLink:      `${process.env.APP_URL}/dashboard`,
        generatedAt:     new Date().toLocaleDateString(),
      },
    }).catch(() => {});

    sent++;
  }

  return sent;
}

// ─── Main job runner ──────────────────────────────────────────────────────────
async function runAllJobs() {
  const start = Date.now();
  console.log(`\n[WORKER] ─── Job cycle started: ${new Date().toISOString()} ───`);

  const results = await Promise.allSettled([
    reviewDueAlerts().then(n    => console.log(`[WORKER]   review alerts:      ${n}`)),
    staleGoalDetection().then(n => console.log(`[WORKER]   stale goals:        ${n}`)),
    signatureExpiry().then(n    => console.log(`[WORKER]   sigs expired:       ${n}`)),
    progressRiskDetection().then(n => console.log(`[WORKER]   risks detected:     ${n}`)),
    subscriptionExpiryCheck().then(n => console.log(`[WORKER]   sub warnings:       ${n}`)),
    weeklyProgressDigest().then(n => console.log(`[WORKER]   digests sent:       ${n}`)),
  ]);

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    failed.forEach(f => console.error('[WORKER] Job failed:', f.reason));
  }

  console.log(`[WORKER] ─── Cycle complete in ${Date.now() - start}ms ───\n`);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
await runAllJobs();

// Run every 6 hours
const SIX_HOURS = 6 * 60 * 60 * 1000;
setInterval(runAllJobs, SIX_HOURS);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[WORKER] Shutting down...');
  await prisma.$disconnect();
  await redis.disconnect();
  process.exit(0);
});
