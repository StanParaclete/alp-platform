/**
 * ALP Platform — ALP Plan Routes
 * Full CRUD + versioning + PDF generation + compliance checking
 */

import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { generateALPPDF } from '../services/pdf.js';
import { checkCompliance } from '../services/compliance.js';
import { notifyFamily } from '../services/notifications.js';

const router = express.Router();

// GET /api/alp — list all ALPs for school
router.get('/', async (req, res) => {
  try {
    const { schoolId, status, studentId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;
    if (req.user.role === 'TEACHER' || req.user.role === 'SPECIAL_ED_TEACHER') {
      where.student = { teachers: { some: { id: req.user.id } } };
    }

    const [plans, total] = await Promise.all([
      prisma.aLPPlan.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, grade: true, photoUrl: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          goals: { select: { id: true, domain: true, status: true } },
          signatures: { select: { id: true, status: true, role: true } },
          _count: { select: { goals: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.aLPPlan.count({ where }),
    ]);

    res.json({ plans, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alp/:id
router.get('/:id', async (req, res) => {
  try {
    const plan = await prisma.aLPPlan.findUnique({
      where: { id: req.params.id },
      include: {
        student: {
          include: {
            disabilities: true,
            teachers: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
        goals: { orderBy: [{ domain: 'asc' }, { orderIndex: 'asc' }] },
        signatures: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        documents: { orderBy: { createdAt: 'desc' } },
        versions: { orderBy: { version: 'desc' }, take: 10 },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!plan) return res.status(404).json({ error: 'ALP not found' });

    // Cache for 5 minutes
    

    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alp — create new ALP
router.post('/', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'SPECIAL_ED_TEACHER']), async (req, res) => {
  try {
    const { studentId, planType, framework, effectiveDate, reviewDate } = req.body;

    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    // Check for existing active plan
    const existing = await prisma.aLPPlan.findFirst({
      where: { studentId, status: { in: ['DRAFT', 'ACTIVE'] } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Student already has an active plan', planId: existing.id });
    }

    const plan = await prisma.aLPPlan.create({
      data: {
        studentId,
        createdById: req.user.id,
        planType: planType || 'ALP',
        framework: framework || 'IDEA_USA',
        status: 'DRAFT',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        reviewDate: reviewDate ? new Date(reviewDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      include: { student: true },
    });

    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alp/:id — autosave section data
router.patch('/:id', async (req, res) => {
  try {
    const { section, data, completionPct } = req.body;

    // Save version snapshot before update
    const current = await prisma.aLPPlan.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'ALP not found' });

    await prisma.aLPVersion.create({
      data: {
        alpId: req.params.id,
        version: current.version,
        snapshot: current,
        createdBy: req.user.id,
      },
    });

    const updateData = { version: { increment: 1 } };
    if (section) updateData[section] = data;
    if (completionPct !== undefined) updateData.completionPct = completionPct;

    const updated = await prisma.aLPPlan.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Invalidate cache
    

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alp/:id/activate
router.post('/:id/activate', requireRole(['SCHOOL_ADMIN', 'SPECIAL_ED_TEACHER']), async (req, res) => {
  try {
    const plan = await prisma.aLPPlan.findUnique({
      where: { id: req.params.id },
      include: { goals: true, student: true },
    });
    if (!plan) return res.status(404).json({ error: 'ALP not found' });

    // Compliance check
    const compliance = await checkCompliance(plan);
    if (!compliance.isCompliant) {
      return res.status(422).json({ error: 'Plan is not compliant', issues: compliance.issues });
    }

    const activated = await prisma.aLPPlan.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', isCompliant: true },
    });

    // Notify family
    await notifyFamily(plan.studentId, {
      title: 'ALP Activated',
      body: `${plan.student.firstName}'s Accelerated Learning Plan has been activated and is ready for your review.`,
      type: 'plan_activated',
      data: { alpId: plan.id },
    });

    res.json(activated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alp/:id/export-pdf
router.post('/:id/export-pdf', async (req, res) => {
  try {
    const plan = await prisma.aLPPlan.findUnique({
      where: { id: req.params.id },
      include: {
        student: { include: { disabilities: true } },
        goals: true,
        signatures: { include: { user: true } },
      },
    });
    if (!plan) return res.status(404).json({ error: 'ALP not found' });

    const pdfBuffer = await generateALPPDF(plan);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ALP_${plan.student.lastName}_${plan.student.firstName}_${new Date().toISOString().split('T')[0]}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alp/:id/compliance
router.get('/:id/compliance', async (req, res) => {
  try {
    const plan = await prisma.aLPPlan.findUnique({
      where: { id: req.params.id },
      include: { goals: true, signatures: true },
    });
    if (!plan) return res.status(404).json({ error: 'ALP not found' });

    const result = await checkCompliance(plan);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
