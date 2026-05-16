/**
 * ALP Platform — Remaining Backend Routes
 * reports.js | compliance.js | notifications.js | schools.js | goals.js | documents.js
 * Built by Stan Paraclete | www.stanparaclete.com
 */

// ═══════════════════════════════════════════════════════════════
// REPORTS ROUTE  —  /api/reports
// ═══════════════════════════════════════════════════════════════
import expressReports from 'express';
export const reportsRouter = expressReports.Router();
import { prisma as prismaR } from '../db.js';

reportsRouter.get('/overview', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const where = schoolId ? { student: { schoolId } } : {};

    const [totalStudents, activePlans, activeGoals, atRiskGoals, upcomingReviews] = await Promise.all([
      prismaR.student.count({ where: schoolId ? { schoolId } : {} }),
      prismaR.aLPPlan.count({ where: { ...where, status: 'ACTIVE' } }),
      prismaR.goal.count({ where: { alp: where, status: 'ACTIVE' } }),
      prismaR.goal.count({ where: { alp: where, status: 'ACTIVE', progress: { none: { recordedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } } } }),
      prismaR.aLPPlan.count({ where: { ...where, reviewDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, status: 'ACTIVE' } }),
    ]);

    res.json({ totalStudents, activePlans, activeGoals, atRiskGoals, upcomingReviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.get('/compliance', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const plans = await prismaR.aLPPlan.findMany({
      where: { student: { schoolId }, status: 'ACTIVE' },
      include: { goals: true, signatures: true, student: { select: { firstName: true, lastName: true } } },
    });

    const results = plans.map(p => ({
      planId:    p.id,
      student:   `${p.student.firstName} ${p.student.lastName}`,
      status:    p.status,
      compliant: p.isCompliant,
      issues: [
        !p.goals.length               ? 'No goals defined'              : null,
        p.signatures.some(s => s.status === 'PENDING') ? 'Pending signatures' : null,
        p.reviewDate < new Date()     ? 'Annual review overdue'         : null,
        p.completionPct < 100         ? `Plan ${100 - p.completionPct}% incomplete` : null,
      ].filter(Boolean),
    }));

    res.json({ plans: results, compliantCount: results.filter(r => r.compliant).length, total: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

reportsRouter.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params; // alp | student-growth | family | district
    // In production: generate PDF/CSV via pdf.js service
    res.json({ message: `Export type '${type}' queued — download link will be emailed within 2 minutes.`, jobId: `export_${Date.now()}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// COMPLIANCE ROUTE  —  /api/compliance
// ═══════════════════════════════════════════════════════════════
import expressCompliance from 'express';
export const complianceRouter = expressCompliance.Router();
import { prisma as prismaC } from '../db.js';

complianceRouter.get('/frameworks', (req, res) => {
  res.json([
    { id: 'IDEA_USA',        name: 'IDEA (USA)',             region: 'United States',  requirements: 14 },
    { id: 'SECTION_504',     name: 'Section 504',             region: 'United States',  requirements: 8  },
    { id: 'VDOE_VIRGINIA',   name: 'VDOE Virginia',           region: 'Virginia, USA',  requirements: 11 },
    { id: 'GES_GHANA',       name: 'GES Ghana SPED',          region: 'Ghana',          requirements: 9  },
    { id: 'NERDC_NIGERIA',   name: 'NERDC Nigeria',           region: 'Nigeria',        requirements: 7  },
    { id: 'KICD_KENYA',      name: 'KICD Kenya',              region: 'Kenya',          requirements: 8  },
    { id: 'WCED_SOUTH_AFRICA',name:'WCED South Africa',       region: 'South Africa',   requirements: 10 },
    { id: 'UK_SEND',         name: 'UK SEND Code',            region: 'United Kingdom', requirements: 12 },
    { id: 'CANADA_IEP',      name: 'Canada IEP',              region: 'Canada',         requirements: 9  },
    { id: 'AUSTRALIA_NCCD',  name: 'Australia NCCD',          region: 'Australia',      requirements: 8  },
    { id: 'CUSTOM',          name: 'Custom Framework',        region: 'Global',         requirements: 0  },
  ]);
});

complianceRouter.get('/check/:alpId', async (req, res) => {
  try {
    const plan = await prismaC.aLPPlan.findUnique({
      where: { id: req.params.alpId },
      include: { goals: true, signatures: true },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const checks = {
      hasStudentInfo:      Object.keys(plan.studentInfo || {}).length > 0,
      hasPresentLevels:    Object.keys(plan.presentLevels || {}).length > 0,
      hasGoals:            plan.goals.length >= 1,
      hasSmartGoals:       plan.goals.every(g => g.description.length > 50 && g.baseline && g.target),
      hasServices:         Array.isArray(plan.services) && plan.services.length > 0,
      hasAccommodations:   Array.isArray(plan.accommodations) && plan.accommodations.length > 0,
      hasFamilyInput:      Object.keys(plan.familyInput || {}).length > 0,
      hasReviewDate:       !!plan.reviewDate,
      hasParentSignature:  plan.signatures.some(s => s.role === 'parent'),
      allSectionsFilled:   plan.completionPct >= 80,
    };

    const issues = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => ({
        field:   k,
        message: {
          hasStudentInfo:     'Student information section is incomplete',
          hasPresentLevels:   'Present levels of performance not documented',
          hasGoals:           'At least one measurable annual goal is required',
          hasSmartGoals:      'All goals must include baseline, target, and description',
          hasServices:        'Special education services must be documented',
          hasAccommodations:  'Accommodations and modifications required',
          hasFamilyInput:     'Family input section must be completed',
          hasReviewDate:      'Annual review date is required',
          hasParentSignature: 'Parent/guardian signature required',
          allSectionsFilled:  'Plan must be at least 80% complete',
        }[k] || k,
      }));

    const isCompliant = issues.length === 0;
    await prismaC.aLPPlan.update({ where: { id: req.params.alpId }, data: { isCompliant } });

    res.json({ isCompliant, checks, issues, score: Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS ROUTE  —  /api/notifications
// ═══════════════════════════════════════════════════════════════
import expressNotif from 'express';
export const notificationsRouter = expressNotif.Router();
import { prisma as prismaNotif } from '../db.js';

notificationsRouter.get('/', async (req, res) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const where = { userId: req.user.id };
    if (unread === 'true') where.isRead = false;

    const [notifs, total, unreadCount] = await Promise.all([
      prismaNotif.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit) }),
      prismaNotif.notification.count({ where }),
      prismaNotif.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({ notifications: notifs, total, unreadCount, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  try {
    const n = await prismaNotif.notification.update({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true, readAt: new Date() } });
    res.json(n);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

notificationsRouter.patch('/read-all', async (req, res) => {
  try {
    const { count } = await prismaNotif.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true, readAt: new Date() } });
    res.json({ updated: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

notificationsRouter.post('/token', async (req, res) => {
  try {
    const { token } = req.body;
    await prismaNotif.user.update({ where: { id: req.user.id }, data: { preferences: { pushToken: token } } });
    res.json({ registered: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

notificationsRouter.delete('/:id', async (req, res) => {
  try {
    await prismaNotif.notification.delete({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// SCHOOLS ROUTE  —  /api/schools
// ═══════════════════════════════════════════════════════════════
import expressSchools from 'express';
export const schoolsRouter = expressSchools.Router();
import { prisma as prismaSchools } from '../db.js';
import { requireRole as rr } from '../middleware/auth.js';

schoolsRouter.get('/', async (req, res) => {
  try {
    const where = req.user.role !== 'SUPER_ADMIN' ? { districtId: req.user.districtId } : {};
    const schools = await prismaSchools.school.findMany({
      where,
      include: {
        _count: { select: { students: true, users: true } },
        district: { select: { name: true, framework: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

schoolsRouter.get('/:id/stats', async (req, res) => {
  try {
    const [students, activePlans, teachers, overdueReviews] = await Promise.all([
      prismaSchools.student.count({ where: { schoolId: req.params.id } }),
      prismaSchools.aLPPlan.count({ where: { student: { schoolId: req.params.id }, status: 'ACTIVE' } }),
      prismaSchools.user.count({ where: { schoolId: req.params.id, role: { in: ['TEACHER', 'SPECIAL_ED_TEACHER'] } } }),
      prismaSchools.aLPPlan.count({ where: { student: { schoolId: req.params.id }, reviewDate: { lt: new Date() }, status: 'ACTIVE' } }),
    ]);
    res.json({ students, activePlans, teachers, overdueReviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// GOALS ROUTE  —  /api/goals
// ═══════════════════════════════════════════════════════════════
import expressGoals from 'express';
export const goalsRouter = expressGoals.Router();
import { prisma as prismaGoals } from '../db.js';

goalsRouter.get('/', async (req, res) => {
  try {
    const { alpId, domain, status } = req.query;
    const where = {};
    if (alpId) where.alpId = alpId;
    if (domain) where.domain = domain;
    if (status) where.status = status;

    const goals = await prismaGoals.goal.findMany({
      where,
      include: { progress: { orderBy: { recordedAt: 'desc' }, take: 10 } },
      orderBy: [{ domain: 'asc' }, { orderIndex: 'asc' }],
    });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

goalsRouter.post('/', async (req, res) => {
  try {
    const { alpId, domain, description, baseline, target, method, monitoring, targetDate, aiGenerated } = req.body;
    const goal = await prismaGoals.goal.create({
      data: { alpId, domain, description, baseline, target, method, monitoring, targetDate: targetDate ? new Date(targetDate) : null, aiGenerated: !!aiGenerated },
    });
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

goalsRouter.patch('/:id', async (req, res) => {
  try {
    const { targetDate, ...data } = req.body;
    const goal = await prismaGoals.goal.update({
      where: { id: req.params.id },
      data: { ...data, ...(targetDate ? { targetDate: new Date(targetDate) } : {}) },
    });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

goalsRouter.delete('/:id', async (req, res) => {
  try {
    await prismaGoals.goal.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

goalsRouter.post('/reorder', async (req, res) => {
  try {
    const { goalIds } = req.body; // ordered array of IDs
    await Promise.all(goalIds.map((id, i) => prismaGoals.goal.update({ where: { id }, data: { orderIndex: i } })));
    res.json({ reordered: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// DOCUMENTS ROUTE  —  /api/documents
// ═══════════════════════════════════════════════════════════════
import expressDocuments from 'express';
export const documentsRouter = expressDocuments.Router();
import { prisma as prismaDocuments } from '../db.js';
import { uploadToS3 as upload, getSignedUrl } from '../services/storage.js';
import multer from 'multer';

const multerStorage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

documentsRouter.get('/', async (req, res) => {
  try {
    const { studentId, alpId, type } = req.query;
    const where = {};
    if (studentId) where.studentId = studentId;
    if (alpId) where.alpId = alpId;
    if (type) where.type = type;

    const documents = await prismaDocuments.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Append signed download URLs
    const withUrls = await Promise.all(documents.map(async d => ({
      ...d,
      downloadUrl: await getSignedUrl(d.url).catch(() => d.url),
    })));

    res.json(withUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

documentsRouter.post('/upload', multerStorage.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { studentId, alpId, type = 'document', tags } = req.body;

    const key = `documents/${studentId || 'general'}/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const url = await upload({ buffer: req.file.buffer, key, mimeType: req.file.mimetype });

    const doc = await prismaDocuments.document.create({
      data: {
        studentId:  studentId  || undefined,
        alpId:      alpId      || undefined,
        uploadedBy: req.user.id,
        name:       req.file.originalname,
        type,
        url,
        size:       req.file.size,
        mimeType:   req.file.mimetype,
        tags:       tags ? tags.split(',').map(t => t.trim()) : [],
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

documentsRouter.delete('/:id', async (req, res) => {
  try {
    await prismaDocuments.document.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
