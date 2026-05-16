/**
 * ALP Platform — Backend Test Suite
 * Jest + Supertest: Auth, Students, ALP, Goals, Progress, AI
 * Built by Stan Paraclete | www.stanparaclete.com
 *
 * Run: npm test
 * Run with coverage: npm test -- --coverage
 */

import request  from 'supertest';
import bcrypt   from 'bcryptjs';
import app      from '../index.js';
import { prisma } from '../index.js';

// ─── Test data ────────────────────────────────────────────────────────────────
let teacherToken  = '';
let adminToken    = '';
let testStudentId = '';
let testALPId     = '';
let testGoalId    = '';

const TEACHER = {
  email:     'test.teacher@westwood.edu',
  password:  'TestPass2026!',
  firstName: 'Test',
  lastName:  'Teacher',
  role:      'SPECIAL_ED_TEACHER',
};

const ADMIN = {
  email:     'test.admin@westwood.edu',
  password:  'TestAdmin2026!',
  firstName: 'Test',
  lastName:  'Admin',
  role:      'SCHOOL_ADMIN',
};

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Create test district + school
  const district = await prisma.district.upsert({
    where:  { code: 'TEST-DIST' },
    update: {},
    create: { name: 'Test District', code: 'TEST-DIST', framework: 'IDEA_USA' },
  });

  const school = await prisma.school.upsert({
    where:  { code: 'TEST-SCHOOL' },
    update: { districtId: district.id },
    create: { districtId: district.id, name: 'Test School', code: 'TEST-SCHOOL' },
  });

  const hash = await bcrypt.hash(TEACHER.password, 10);

  // Create teacher
  await prisma.user.upsert({
    where:  { email: TEACHER.email },
    update: {},
    create: { ...TEACHER, passwordHash: hash, schoolId: school.id, districtId: district.id },
  });

  // Create admin
  const adminHash = await bcrypt.hash(ADMIN.password, 10);
  await prisma.user.upsert({
    where:  { email: ADMIN.email },
    update: {},
    create: { ...ADMIN, passwordHash: adminHash, schoolId: school.id, districtId: district.id },
  });
});

afterAll(async () => {
  // Clean up test data
  if (testStudentId) {
    await prisma.student.delete({ where: { id: testStudentId } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: { in: [TEACHER.email, ADMIN.email] } } }).catch(() => {});
  await prisma.$disconnect();
});


// ═══════════════════════════════════════════════════════════════
// AUTH TESTS
// ═══════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  test('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEACHER.email, password: 'WrongPassword!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEACHER.email, password: TEACHER.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(TEACHER.email);
    teacherToken = res.body.accessToken;
  });

  test('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'AnyPass123!' });
    expect(res.status).toBe(401);
  });

  test('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notanemail', password: 'SomePass1!' });
    expect(res.status).toBe(400);
  });

  test('admin login works', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.status).toBe(200);
    adminToken = res.body.accessToken;
  });
});

describe('GET /api/auth/me', () => {
  test('returns current user for valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEACHER.email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('always returns success (prevents enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'anyemail@anywhere.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});


// ═══════════════════════════════════════════════════════════════
// STUDENTS TESTS
// ═══════════════════════════════════════════════════════════════
describe('GET /api/students', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });

  test('returns paginated student list', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('students');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(Array.isArray(res.body.students)).toBe(true);
  });

  test('supports search query', async () => {
    const res = await request(app)
      .get('/api/students?q=Johnson')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.students)).toBe(true);
  });
});

describe('POST /api/students', () => {
  test('creates a new student', async () => {
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName:   'Test',
        lastName:    'Student',
        dateOfBirth: '2016-01-15',
        grade:       '3',
        primaryLanguage: 'English',
        supportLevel: 2,
        disabilities: [{ category: 'ADHD', isPrimary: true }],
      });
    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe('Test');
    expect(res.body.id).toBeDefined();
    testStudentId = res.body.id;
  });

  test('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Incomplete' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/students/:id', () => {
  test('returns full student profile', async () => {
    if (!testStudentId) return;
    const res = await request(app)
      .get(`/api/students/${testStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testStudentId);
    expect(res.body.disabilities).toBeDefined();
  });

  test('returns 404 for non-existent student', async () => {
    const res = await request(app)
      .get('/api/students/nonexistent-id-12345')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});


// ═══════════════════════════════════════════════════════════════
// ALP PLAN TESTS
// ═══════════════════════════════════════════════════════════════
describe('POST /api/alp', () => {
  test('creates a new ALP plan', async () => {
    if (!testStudentId) return;
    const res = await request(app)
      .post('/api/alp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId:    testStudentId,
        planType:     'ALP',
        framework:    'IDEA_USA',
        effectiveDate: new Date().toISOString(),
        reviewDate:    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.studentId).toBe(testStudentId);
    expect(res.body.status).toBe('DRAFT');
    testALPId = res.body.id;
  });

  test('returns 400 for missing studentId', async () => {
    const res = await request(app)
      .post('/api/alp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planType: 'ALP' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/alp/:id', () => {
  test('returns full ALP plan', async () => {
    if (!testALPId) return;
    const res = await request(app)
      .get(`/api/alp/${testALPId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testALPId);
    expect(res.body.goals).toBeDefined();
    expect(res.body.signatures).toBeDefined();
  });
});

describe('PATCH /api/alp/:id', () => {
  test('updates ALP section data', async () => {
    if (!testALPId) return;
    const res = await request(app)
      .patch(`/api/alp/${testALPId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        section: 'presentLevels',
        data: { reading: 'Reads at 2nd grade level', math: 'Strong number sense' },
        completionPct: 20,
      });
    expect(res.status).toBe(200);
    expect(res.body.completionPct).toBe(20);
  });
});

describe('GET /api/alp/:id/compliance', () => {
  test('returns compliance check results', async () => {
    if (!testALPId) return;
    const res = await request(app)
      .get(`/api/alp/${testALPId}/compliance`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isCompliant');
    expect(res.body).toHaveProperty('score');
    expect(res.body).toHaveProperty('issues');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════
// GOALS TESTS
// ═══════════════════════════════════════════════════════════════
describe('POST /api/goals', () => {
  test('creates a new goal', async () => {
    if (!testALPId) return;
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        alpId:       testALPId,
        domain:      'READING',
        description: 'By May 2027, Test Student will read grade 3-level text with 80% accuracy and 80 wcpm.',
        baseline:    '52 wcpm',
        target:      '80 wcpm',
        monitoring:  'Weekly',
      });
    expect(res.status).toBe(201);
    expect(res.body.domain).toBe('READING');
    testGoalId = res.body.id;
  });
});

describe('GET /api/goals', () => {
  test('returns goals for an ALP', async () => {
    if (!testALPId) return;
    const res = await request(app)
      .get(`/api/goals?alpId=${testALPId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PATCH /api/goals/:id/status', () => {
  test('updates goal status', async () => {
    if (!testGoalId) return;
    const res = await request(app)
      .patch(`/api/goals/${testGoalId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'MASTERED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('MASTERED');
  });
});


// ═══════════════════════════════════════════════════════════════
// PROGRESS TESTS
// ═══════════════════════════════════════════════════════════════
describe('POST /api/progress', () => {
  test('logs a progress data point', async () => {
    if (!testGoalId) return;
    const res = await request(app)
      .post('/api/progress')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ goalId: testGoalId, value: 65, unit: 'wcpm', notes: 'Good session' });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe(65);
  });

  test('returns 400 without goalId', async () => {
    const res = await request(app)
      .post('/api/progress')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ value: 70 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/progress/bulk', () => {
  test('bulk logs multiple progress entries', async () => {
    if (!testGoalId) return;
    const res = await request(app)
      .post('/api/progress/bulk')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ entries: [{ goalId: testGoalId, value: 67 }, { goalId: testGoalId, value: 69 }] });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
  });
});


// ═══════════════════════════════════════════════════════════════
// COMPLIANCE TESTS
// ═══════════════════════════════════════════════════════════════
describe('GET /api/compliance/frameworks', () => {
  test('returns all compliance frameworks', async () => {
    const res = await request(app)
      .get('/api/compliance/frameworks')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(5);
    expect(res.body.find(f => f.id === 'IDEA_USA')).toBeDefined();
    expect(res.body.find(f => f.id === 'GES_GHANA')).toBeDefined();
  });
});


// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS TESTS
// ═══════════════════════════════════════════════════════════════
describe('GET /api/notifications', () => {
  test('returns notification list', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body).toHaveProperty('unreadCount');
  });
});


// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════
describe('GET /health', () => {
  test('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services).toBeDefined();
  });
});

describe('GET /unknown-route', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-endpoint');
    expect(res.status).toBe(404);
  });
});
