/**
 * ALP Platform — Students Routes
 * Full CRUD + search + caseload + disability management
 * Built by Stan Paraclete | www.stanparaclete.com
 */

import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { uploadToS3 } from '../services/storage.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const studentSchema = z.object({
  firstName:       z.string().min(1).max(50),
  lastName:        z.string().min(1).max(50),
  dateOfBirth:     z.string(),
  grade:           z.string(),
  gender:          z.string().optional(),
  ethnicity:       z.string().optional(),
  primaryLanguage: z.string().default('English'),
  studentNumber:   z.string().optional(),
  address:         z.string().optional(),
  emergencyContact:z.string().optional(),
  supportLevel:    z.number().int().min(1).max(3).default(1),
  disabilities:    z.array(z.object({
    category:    z.string(),
    isPrimary:   z.boolean().default(false),
    diagnosedAt: z.string().optional(),
    diagnosedBy: z.string().optional(),
    notes:       z.string().optional(),
  })).optional(),
});

// GET /api/students — list with search + filters
router.get('/', async (req, res) => {
  try {
    const {
      q, grade, disability, status, teacherId,
      page = 1, limit = 25, sortBy = 'lastName', sortDir = 'asc'
    } = req.query;

    const where = { isActive: true };

    // School-scoped access
    if (req.user.schoolId) where.schoolId = req.user.schoolId;

    // Teacher sees only their caseload
    if (req.user.role === 'TEACHER' || req.user.role === 'SPECIAL_ED_TEACHER') {
      where.teachers = { some: { id: req.user.id } };
    }

    if (q) {
      where.OR = [
        { firstName:    { contains: q, mode: 'insensitive' } },
        { lastName:     { contains: q, mode: 'insensitive' } },
        { studentNumber:{ contains: q, mode: 'insensitive' } },
      ];
    }
    if (grade)    where.grade = grade;
    if (disability) where.disabilities = { some: { category: disability } };
    if (teacherId) where.teachers = { some: { id: teacherId } };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orderBy = { [sortBy]: sortDir };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          disabilities:  { where: { isPrimary: true }, take: 1 },
          alpPlans:      { where: { status: { in: ['ACTIVE', 'DRAFT'] } }, select: { id: true, status: true, reviewDate: true, completionPct: true } },
          teachers:      { select: { id: true, firstName: true, lastName: true } },
          _count:        { select: { alpPlans: true } },
        },
        orderBy,
        skip,
        take: parseInt(limit),
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ students, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id — full student profile
router.get('/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        disabilities: true,
        alpPlans: {
          include: {
            goals:      { include: { progress: { orderBy: { recordedAt: 'desc' }, take: 5 } } },
            signatures: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        teachers:  { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        meetings:  { include: { meeting: true }, orderBy: { meeting: { scheduledAt: 'desc' } }, take: 5 },
      },
    });

    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Verify access
    const hasAccess =
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'DISTRICT_MANAGER' ||
      req.user.role === 'SCHOOL_ADMIN' ||
      student.teachers.some(t => t.id === req.user.id);

    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students — create student
router.post('/', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'SPECIAL_ED_TEACHER']), async (req, res) => {
  try {
    const data = studentSchema.parse(req.body);
    const { disabilities, ...studentData } = data;

    const student = await prisma.student.create({
      data: {
        ...studentData,
        schoolId:    req.user.schoolId,
        dateOfBirth: new Date(studentData.dateOfBirth),
        teachers:    { connect: [{ id: req.user.id }] },
        ...(disabilities?.length ? {
          disabilities: { create: disabilities.map(d => ({
            ...d,
            diagnosedAt: d.diagnosedAt ? new Date(d.diagnosedAt) : undefined,
          })) },
        } : {}),
      },
      include: { disabilities: true, teachers: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.status(201).json(student);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/students/:id
router.patch('/:id', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'SPECIAL_ED_TEACHER']), async (req, res) => {
  try {
    const { disabilities, ...data } = req.body;

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
      },
    });

    // Update disabilities if provided
    if (disabilities) {
      await prisma.studentDisability.deleteMany({ where: { studentId: req.params.id } });
      if (disabilities.length) {
        await prisma.studentDisability.createMany({
          data: disabilities.map(d => ({ ...d, studentId: req.params.id })),
        });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id (soft delete)
router.delete('/:id', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    await prisma.student.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Student deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/:id/photo — upload profile photo
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const url = await uploadToS3({
      buffer:   req.file.buffer,
      key:      `students/${req.params.id}/photo.${req.file.mimetype.split('/')[1]}`,
      mimeType: req.file.mimetype,
    });

    await prisma.student.update({ where: { id: req.params.id }, data: { photoUrl: url } });
    res.json({ photoUrl: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/:id/assign-teacher
router.post('/:id/assign-teacher', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    const { teacherId } = req.body;
    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data:  { teachers: { connect: { id: teacherId } } },
      include: { teachers: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id/timeline — activity timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const [plans, meetings, documents, progress] = await Promise.all([
      prisma.aLPPlan.findMany({ where: { studentId: req.params.id }, select: { id: true, status: true, createdAt: true, planType: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.meetingParticipant.findMany({ where: { studentId: req.params.id }, include: { meeting: true }, take: 10 }),
      prisma.document.findMany({ where: { studentId: req.params.id }, select: { id: true, name: true, type: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.progress.findMany({
        where: { goal: { alp: { studentId: req.params.id } } },
        include: { goal: { select: { domain: true, description: true } } },
        orderBy: { recordedAt: 'desc' },
        take: 20,
      }),
    ]);

    const events = [
      ...plans.map(p => ({ type: 'plan', date: p.createdAt, data: p })),
      ...meetings.map(m => ({ type: 'meeting', date: m.meeting.scheduledAt, data: m.meeting })),
      ...documents.map(d => ({ type: 'document', date: d.createdAt, data: d })),
      ...progress.map(p => ({ type: 'progress', date: p.recordedAt, data: p })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
