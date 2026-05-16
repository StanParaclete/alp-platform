/**
 * ALP Platform — Goals Route
 * Measurable annual goals: CRUD, reorder, status updates
 * Built by Stan Paraclete | www.stanparaclete.com
 */

import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';

const router = express.Router();

const goalSchema = z.object({
  alpId:       z.string(),
  domain:      z.string(),
  customDomain:z.string().optional(),
  description: z.string().min(10),
  baseline:    z.string(),
  target:      z.string(),
  method:      z.string().optional(),
  monitoring:  z.string().default('Monthly'),
  targetDate:  z.string().optional(),
  aiGenerated: z.boolean().default(false),
  orderIndex:  z.number().int().default(0),
});

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const { alpId, domain, status } = req.query;
    const where = {};
    if (alpId)  where.alpId  = alpId;
    if (domain) where.domain = domain;
    if (status) where.status = status;

    const goals = await prisma.goal.findMany({
      where,
      include: {
        progress: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: [{ domain: 'asc' }, { orderIndex: 'asc' }],
    });

    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/goals/:id
router.get('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: {
        progress: { orderBy: { recordedAt: 'asc' } },
        alp: {
          select: {
            id: true, status: true,
            student: { select: { id: true, firstName: true, lastName: true, grade: true } },
          },
        },
      },
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const data = goalSchema.parse(req.body);
    const goal = await prisma.goal.create({
      data: {
        ...data,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      },
    });
    res.status(201).json(goal);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/goals/:id
router.patch('/:id', async (req, res) => {
  try {
    const { targetDate, masteredDate, ...data } = req.body;
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(targetDate  ? { targetDate:  new Date(targetDate)  } : {}),
        ...(masteredDate? { masteredDate: new Date(masteredDate)} : {}),
      },
    });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.goal.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals/reorder — bulk reorder goals in builder
router.post('/reorder', async (req, res) => {
  try {
    const { goalIds } = req.body; // ordered array of IDs
    if (!Array.isArray(goalIds)) return res.status(400).json({ error: 'goalIds must be array' });

    await Promise.all(
      goalIds.map((id, i) =>
        prisma.goal.update({ where: { id }, data: { orderIndex: i } })
      )
    );
    res.json({ reordered: goalIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/goals/:id/status — mastered / discontinued / etc.
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const allowed = ['ACTIVE', 'MASTERED', 'NOT_MET', 'DISCONTINUED', 'PENDING'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'MASTERED'      ? { masteredDate: new Date() } : {}),
        ...(status === 'DISCONTINUED'  ? { notes: reason }           : {}),
      },
    });

    // Notify if mastered
    if (status === 'MASTERED') {
      const fullGoal = await prisma.goal.findUnique({
        where: { id: req.params.id },
        include: { alp: { include: { createdBy: true, student: true } } },
      });
      if (fullGoal?.alp) {
        await prisma.notification.create({
          data: {
            userId: fullGoal.alp.createdById,
            title:  '🎉 Goal Mastered!',
            body:   `${fullGoal.alp.student.firstName}'s ${goal.domain.replace(/_/g, ' ')} goal has been mastered!`,
            type:   'goal_mastered',
            data:   { goalId: goal.id, alpId: goal.alpId },
          },
        }).catch(() => {});
      }
    }

    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
