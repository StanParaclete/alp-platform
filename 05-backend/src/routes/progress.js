/**
 * ALP Platform — Progress Monitoring Routes
 * CBM data entry, trend analysis, goal tracking, risk alerts
 * Built by Stan Paraclete | www.stanparaclete.com
 */

import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
const redis = { get: async()=>null, set: async()=>'OK', del: async()=>1 };

const router = express.Router();

const progressSchema = z.object({
  goalId:     z.string(),
  value:      z.number(),
  unit:       z.string().default('percent'),
  notes:      z.string().optional(),
  recordedAt: z.string().optional(),
});

// GET /api/progress — all progress for a student or goal
router.get('/', async (req, res) => {
  try {
    const { studentId, goalId, domain, from, to, limit = 50 } = req.query;

    const where = {};

    if (goalId) {
      where.goalId = goalId;
    } else if (studentId) {
      where.goal = { alp: { studentId } };
    }

    if (domain) where.goal = { ...where.goal, domain };
    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to)   where.recordedAt.lte = new Date(to);
    }

    const records = await prisma.progress.findMany({
      where,
      include: {
        goal: {
          select: { id: true, domain: true, description: true, baseline: true, target: true, alp: { select: { studentId: true } } },
        },
      },
      orderBy: { recordedAt: 'asc' },
      take: parseInt(limit),
    });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/progress/summary/:studentId — dashboard summary with trends
router.get('/summary/:studentId', async (req, res) => {
  try {
    const cacheKey = `progress:summary:${req.params.studentId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const activePlan = await prisma.aLPPlan.findFirst({
      where: { studentId: req.params.studentId, status: 'ACTIVE' },
      include: {
        goals: {
          include: {
            progress: {
              orderBy: { recordedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!activePlan) return res.json({ goals: [], overallProgress: 0 });

    const goalSummaries = activePlan.goals.map(goal => {
      const records = goal.progress;
      const latest = records[records.length - 1];
      const previous = records[records.length - 2];

      // Calculate trend (slope of last 4 data points)
      const recent = records.slice(-4);
      let trend = 0;
      if (recent.length >= 2) {
        const first = recent[0].value;
        const last = recent[recent.length - 1].value;
        trend = ((last - first) / recent.length);
      }

      // Project to goal end date
      const baseline = parseFloat(goal.baseline) || 0;
      const target = parseFloat(goal.target) || 100;
      const currentPct = latest ? Math.round(((latest.value - baseline) / (target - baseline)) * 100) : 0;

      // Risk assessment
      const weeksRemaining = goal.targetDate
        ? Math.max(0, Math.ceil((new Date(goal.targetDate) - new Date()) / (7 * 24 * 60 * 60 * 1000)))
        : 52;

      const projectedFinal = latest ? latest.value + (trend * weeksRemaining) : baseline;
      const isAtRisk = projectedFinal < (target * 0.8);

      return {
        goalId:         goal.id,
        domain:         goal.domain,
        description:    goal.description,
        baseline:       goal.baseline,
        target:         goal.target,
        status:         goal.status,
        latestValue:    latest?.value,
        latestDate:     latest?.recordedAt,
        trend,
        trendDirection: trend > 0.5 ? 'improving' : trend < -0.5 ? 'declining' : 'stable',
        progressPct:    Math.min(100, Math.max(0, currentPct)),
        isAtRisk,
        projectedFinal: Math.round(projectedFinal * 10) / 10,
        dataPoints:     records.length,
        history:        records.map(r => ({ date: r.recordedAt, value: r.value, notes: r.notes })),
      };
    });

    const overallProgress = goalSummaries.length > 0
      ? Math.round(goalSummaries.reduce((sum, g) => sum + g.progressPct, 0) / goalSummaries.length)
      : 0;

    const result = {
      studentId:       req.params.studentId,
      planId:          activePlan.id,
      goals:           goalSummaries,
      overallProgress,
      atRiskCount:     goalSummaries.filter(g => g.isAtRisk).length,
      lastUpdated:     new Date().toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(result), { EX: 300 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/progress — log new data point
router.post('/', async (req, res) => {
  try {
    const data = progressSchema.parse(req.body);

    const goal = await prisma.goal.findUnique({ where: { id: data.goalId }, include: { alp: true } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const record = await prisma.progress.create({
      data: {
        goalId:     data.goalId,
        recordedBy: req.user.id,
        value:      data.value,
        unit:       data.unit,
        notes:      data.notes,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
      },
      include: { goal: { select: { domain: true, target: true, alp: { select: { studentId: true } } } } },
    });

    // Invalidate summary cache
    await redis.del(`progress:summary:${record.goal.alp.studentId}`);

    // Check if goal was mastered
    const targetValue = parseFloat(goal.target);
    if (!isNaN(targetValue) && data.value >= targetValue) {
      // Check if criterion met across multiple data points (e.g., 3 consecutive)
      const recent = await prisma.progress.findMany({
        where: { goalId: data.goalId },
        orderBy: { recordedAt: 'desc' },
        take: 3,
      });

      if (recent.length >= 3 && recent.every(r => r.value >= targetValue)) {
        await prisma.goal.update({
          where: { id: data.goalId },
          data: { status: 'MASTERED', masteredDate: new Date() },
        });

        // Notify teacher
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            title:  '🎉 Goal Mastered!',
            body:   `${goal.domain} goal has been mastered across 3 consecutive data points.`,
            type:   'goal_mastered',
            data:   { goalId: data.goalId },
          },
        });
      }
    }

    res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/progress/bulk — bulk log multiple goals at once
router.post('/bulk', async (req, res) => {
  try {
    const { entries } = req.body; // [{ goalId, value, notes }]
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });

    const records = await prisma.progress.createMany({
      data: entries.map(e => ({
        goalId:     e.goalId,
        recordedBy: req.user.id,
        value:      e.value,
        unit:       e.unit || 'percent',
        notes:      e.notes,
        recordedAt: e.recordedAt ? new Date(e.recordedAt) : new Date(),
      })),
    });

    res.status(201).json({ created: records.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/progress/:id — remove a data point (corrections)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.progress.delete({ where: { id: req.params.id } });
    res.json({ message: 'Progress record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/progress/report/:studentId — generate progress report data
router.get('/report/:studentId', async (req, res) => {
  try {
    const { period = 'quarter' } = req.query;
    const periodDays = { week: 7, month: 30, quarter: 90, year: 365 }[period] || 90;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      include: {
        alpPlans: {
          where: { status: 'ACTIVE' },
          include: {
            goals: {
              include: {
                progress: { where: { recordedAt: { gte: since } }, orderBy: { recordedAt: 'asc' } },
              },
            },
          },
          take: 1,
        },
        disabilities: { where: { isPrimary: true }, take: 1 },
      },
    });

    if (!student) return res.status(404).json({ error: 'Student not found' });

    res.json({
      student:   { id: student.id, name: `${student.firstName} ${student.lastName}`, grade: student.grade },
      period:    { label: period, from: since, to: new Date() },
      plan:      student.alpPlans[0] || null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
