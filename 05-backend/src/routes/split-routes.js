/**
 * ALP Platform — Standalone Route Files
 * reports | notifications | schools | documents | compliance
 * Built by Stan Paraclete | www.stanparaclete.com
 */

// ════════════════════════════════════════════════════════════
// EXPORT: reportsRouter   →  src/routes/reports.js
// EXPORT: notifRouter     →  src/routes/notifications.js
// EXPORT: schoolsRouter   →  src/routes/schools.js
// EXPORT: documentsRouter →  src/routes/documents.js
// EXPORT: complianceRouter→  src/routes/compliance.js
// ════════════════════════════════════════════════════════════

// Each export below is the default export for its own file.
// During scaffolding they share this module; when deploying,
// split each section into its own file at the path noted above.

import express from 'express';
import multer  from 'multer';
import { prisma } from '../db.js';
import { requireRole } from '../middleware/auth.js';
;


// ────────────────────────────────────────────────────────────
// REPORTS  →  src/routes/reports.js
// ────────────────────────────────────────────────────────────
export const reportsRouter = express.Router();

reportsRouter.get('/overview', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const studentWhere  = schoolId ? { schoolId }                        : {};
    const planWhere     = schoolId ? { student: { schoolId } }           : {};

    const [
      totalStudents, activePlans, activeGoals,
      masteredGoals, overdueReviews, pendingSignatures,
    ] = await Promise.all([
      prisma.student.count({ where: { ...studentWhere, isActive: true } }),
      prisma.aLPPlan.count({ where: { ...planWhere, status: 'ACTIVE' } }),
      prisma.goal.count({ where: { alp: planWhere, status: 'ACTIVE' } }),
      prisma.goal.count({ where: { alp: planWhere, status: 'MASTERED' } }),
      prisma.aLPPlan.count({ where: { ...planWhere, reviewDate: { lt: new Date() }, status: 'ACTIVE' } }),
      prisma.signature.count({ where: { alp: planWhere, status: 'PENDING' } }),
    ]);

    res.json({
      totalStudents, activePlans, activeGoals,
      masteredGoals, overdueReviews, pendingSignatures,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.get('/compliance', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const plans = await prisma.aLPPlan.findMany({
      where:   { student: { schoolId }, status: { in: ['ACTIVE','DRAFT'] } },
      include: { goals: true, signatures: true, student: { select: { firstName: true, lastName: true } } },
    });

    const results = plans.map(p => ({
      planId:    p.id,
      student:   `${p.student.firstName} ${p.student.lastName}`,
      status:    p.status,
      compliant: p.isCompliant,
      completion:p.completionPct,
      issues: [
        !p.goals.length                                  && 'No goals defined',
        p.signatures.some(s => s.status === 'PENDING')  && 'Pending signatures',
        p.reviewDate < new Date()                        && 'Annual review overdue',
        p.completionPct < 100                            && `${100 - p.completionPct}% incomplete`,
      ].filter(Boolean),
    }));

    res.json({
      plans,
      compliantCount: results.filter(r => r.compliant).length,
      total: results.length,
      compliancePct: results.length ? Math.round((results.filter(r => r.compliant).length / results.length) * 100) : 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.get('/student-growth', async (req, res) => {
  try {
    const { studentId, from, to } = req.query;
    const since = from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const until = to   ? new Date(to)   : new Date();

    const progress = await prisma.progress.findMany({
      where: {
        goal:       { alp: { studentId } },
        recordedAt: { gte: since, lte: until },
      },
      include: { goal: { select: { domain: true, baseline: true, target: true } } },
      orderBy: { recordedAt: 'asc' },
    });

    // Group by domain
    const byDomain = progress.reduce((acc, p) => {
      const d = p.goal.domain;
      if (!acc[d]) acc[d] = [];
      acc[d].push({ date: p.recordedAt, value: p.value, notes: p.notes });
      return acc;
    }, {});

    res.json({ studentId, period: { from: since, to: until }, byDomain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.post('/export', async (req, res) => {
  try {
    const { type, studentId, format = 'pdf' } = req.body;
    // In production: queue PDF generation job via Redis
    res.json({
      queued:   true,
      jobId:    `export_${Date.now()}`,
      message:  `${type} report queued in ${format} format. You will be notified when ready.`,
      eta:      '2-3 minutes',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ────────────────────────────────────────────────────────────
// NOTIFICATIONS  →  src/routes/notifications.js
// ────────────────────────────────────────────────────────────
export const notifRouter = express.Router();

notifRouter.get('/', async (req, res) => {
  try {
    const { unread, type, page = 1, limit = 20 } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = { userId: req.user.id };
    if (unread === 'true') where.isRead = false;
    if (type) where.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({ notifications, total, unreadCount, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

notifRouter.patch('/:id/read', async (req, res) => {
  try {
    const n = await prisma.notification.update({
      where: { id: req.params.id, userId: req.user.id },
      data:  { isRead: true, readAt: new Date() },
    });
    res.json(n);
  } catch (err) {
    res.status(404).json({ error: 'Notification not found' });
  }
});

notifRouter.patch('/read-all', async (req, res) => {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    res.json({ updated: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

notifRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
});

notifRouter.post('/token', async (req, res) => {
  try {
    const { token, platform } = req.body;
    const prefs = req.user.preferences || {};
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { preferences: { ...prefs, pushToken: token, platform } },
    });
    res.json({ registered: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ────────────────────────────────────────────────────────────
// SCHOOLS  →  src/routes/schools.js
// ────────────────────────────────────────────────────────────
export const schoolsRouter = express.Router();

schoolsRouter.get('/', async (req, res) => {
  try {
    const where = req.user.role !== 'SUPER_ADMIN' ? { districtId: req.user.districtId } : {};
    const schools = await prisma.school.findMany({
      where,
      include: {
        _count:   { select: { students: true, users: true } },
        district: { select: { id: true, name: true, framework: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

schoolsRouter.get('/:id', async (req, res) => {
  try {
    const school = await prisma.school.findUnique({
      where:   { id: req.params.id },
      include: {
        district:   true,
        users:      { select: { id: true, firstName: true, lastName: true, role: true } },
        _count:     { select: { students: true, users: true } },
      },
    });
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

schoolsRouter.get('/:id/stats', async (req, res) => {
  try {
    const [students, activePlans, teachers, overdueReviews, masteredGoals] = await Promise.all([
      prisma.student.count({ where: { schoolId: req.params.id, isActive: true } }),
      prisma.aLPPlan.count({ where: { student: { schoolId: req.params.id }, status: 'ACTIVE' } }),
      prisma.user.count({ where: { schoolId: req.params.id, role: { in: ['TEACHER','SPECIAL_ED_TEACHER'] } } }),
      prisma.aLPPlan.count({ where: { student: { schoolId: req.params.id }, reviewDate: { lt: new Date() }, status: 'ACTIVE' } }),
      prisma.goal.count({ where: { alp: { student: { schoolId: req.params.id } }, status: 'MASTERED' } }),
    ]);
    res.json({ students, activePlans, teachers, overdueReviews, masteredGoals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

schoolsRouter.post('/', requireRole(['SUPER_ADMIN', 'DISTRICT_MANAGER']), async (req, res) => {
  try {
    const school = await prisma.school.create({ data: { ...req.body, districtId: req.user.districtId } });
    res.status(201).json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

schoolsRouter.patch('/:id', requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DISTRICT_MANAGER']), async (req, res) => {
  try {
    const school = await prisma.school.update({ where: { id: req.params.id }, data: req.body });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ────────────────────────────────────────────────────────────
// DOCUMENTS  →  src/routes/documents.js
// ────────────────────────────────────────────────────────────
export const documentsRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

documentsRouter.get('/', async (req, res) => {
  try {
    const { studentId, alpId, type } = req.query;
    const where = {};
    if (studentId) where.studentId = studentId;
    if (alpId)     where.alpId     = alpId;
    if (type)      where.type      = type;

    const docs = await prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

documentsRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const { studentId, alpId, type = 'document', tags = '' } = req.body;

    // In production: upload to S3 via storage service
    // For now, record metadata
    const doc = await prisma.document.create({
      data: {
        studentId:  studentId  || null,
        alpId:      alpId      || null,
        uploadedBy: req.user.id,
        name:       req.file.originalname,
        type,
        url:        `/uploads/${Date.now()}_${req.file.originalname}`,
        size:       req.file.size,
        mimeType:   req.file.mimetype,
        tags:       tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

documentsRouter.get('/:id', async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

documentsRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(404).json({ error: 'Document not found' });
  }
});

documentsRouter.patch('/:id/tags', async (req, res) => {
  try {
    const { tags } = req.body;
    const doc = await prisma.document.update({ where: { id: req.params.id }, data: { tags } });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ────────────────────────────────────────────────────────────
// COMPLIANCE  →  src/routes/compliance.js
// ────────────────────────────────────────────────────────────
export const complianceRouter = express.Router();

complianceRouter.get('/frameworks', (req, res) => {
  res.json([
    { id: 'IDEA_USA',         name: 'IDEA (USA)',          region: 'United States', mandatoryFields: ['goals','services','accommodations','parentSignature','reviewDate'] },
    { id: 'SECTION_504',      name: 'Section 504',          region: 'United States', mandatoryFields: ['accommodations','reviewDate'] },
    { id: 'VDOE_VIRGINIA',    name: 'VDOE Virginia',        region: 'Virginia, USA', mandatoryFields: ['goals','services','accommodations','parentSignature','reviewDate','presentLevels'] },
    { id: 'GES_GHANA',        name: 'GES Ghana SPED',       region: 'Ghana',         mandatoryFields: ['goals','presentLevels','familyInput'] },
    { id: 'NERDC_NIGERIA',    name: 'NERDC Nigeria',        region: 'Nigeria',        mandatoryFields: ['goals','services','reviewDate'] },
    { id: 'KICD_KENYA',       name: 'KICD Kenya',           region: 'Kenya',          mandatoryFields: ['goals','services','accommodations'] },
    { id: 'WCED_SOUTH_AFRICA',name: 'WCED South Africa',    region: 'South Africa',   mandatoryFields: ['goals','accommodations','familyInput'] },
    { id: 'UK_SEND',          name: 'UK SEND Code',         region: 'United Kingdom', mandatoryFields: ['goals','services','parentSignature','reviewDate','outcomes'] },
    { id: 'CANADA_IEP',       name: 'Canada IEP',           region: 'Canada',         mandatoryFields: ['goals','services','accommodations','reviewDate'] },
    { id: 'AUSTRALIA_NCCD',   name: 'Australia NCCD',       region: 'Australia',      mandatoryFields: ['goals','adjustments','reviewDate'] },
    { id: 'CUSTOM',           name: 'Custom Framework',     region: 'Global',         mandatoryFields: [] },
  ]);
});

complianceRouter.get('/check/:alpId', async (req, res) => {
  try {
    const plan = await prisma.aLPPlan.findUnique({
      where:   { id: req.params.alpId },
      include: { goals: true, signatures: true },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const checks = {
      hasStudentInfo:    Object.keys(plan.studentInfo    || {}).length > 0,
      hasPresentLevels:  Object.keys(plan.presentLevels  || {}).length > 0,
      hasGoals:          plan.goals.length >= 1,
      hasSmartGoals:     plan.goals.length > 0 && plan.goals.every(g => g.description?.length > 20 && g.baseline && g.target),
      hasServices:       Array.isArray(plan.services)       && plan.services.length > 0,
      hasAccommodations: Array.isArray(plan.accommodations) && plan.accommodations.length > 0,
      hasFamilyInput:    Object.keys(plan.familyInput    || {}).length > 0,
      hasReviewDate:     !!plan.reviewDate,
      hasParentSignature:plan.signatures.some(s => s.role === 'parent'),
      isComplete:        (plan.completionPct || 0) >= 80,
    };

    const issues = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => ({
        field:    k,
        severity: ['hasGoals', 'hasParentSignature', 'hasReviewDate'].includes(k) ? 'critical' : 'warning',
        message: {
          hasStudentInfo:    'Student information section is incomplete',
          hasPresentLevels:  'Present levels of performance not documented',
          hasGoals:          'At least one measurable annual goal is required',
          hasSmartGoals:     'All goals must include baseline, target, and description (min 20 chars)',
          hasServices:       'Special education services must be documented',
          hasAccommodations: 'Accommodations and modifications are required',
          hasFamilyInput:    'Family input section must be completed',
          hasReviewDate:     'Annual review date is required',
          hasParentSignature:'Parent/guardian signature required for plan activation',
          isComplete:        `Plan is ${plan.completionPct || 0}% complete — minimum 80% required`,
        }[k] || k,
      }));

    const score = Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100);
    const isCompliant = issues.filter(i => i.severity === 'critical').length === 0;

    // Update plan compliance status
    await prisma.aLPPlan.update({ where: { id: req.params.alpId }, data: { isCompliant } });

    res.json({ isCompliant, score, checks, issues, framework: plan.framework });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

complianceRouter.get('/school-report', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const [totalPlans, compliantPlans, overdueReviews, pendingSigs] = await Promise.all([
      prisma.aLPPlan.count({ where: { student: { schoolId }, status: 'ACTIVE' } }),
      prisma.aLPPlan.count({ where: { student: { schoolId }, status: 'ACTIVE', isCompliant: true } }),
      prisma.aLPPlan.count({ where: { student: { schoolId }, status: 'ACTIVE', reviewDate: { lt: new Date() } } }),
      prisma.signature.count({ where: { alp: { student: { schoolId } }, status: 'PENDING' } }),
    ]);

    res.json({
      schoolId,
      totalPlans,
      compliantPlans,
      compliancePct: totalPlans ? Math.round((compliantPlans / totalPlans) * 100) : 100,
      overdueReviews,
      pendingSigs,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
