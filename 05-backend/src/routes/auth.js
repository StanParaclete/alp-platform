/**
 * ALP Platform — Auth Routes
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateTokens, authenticate } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'alp-dev-secret-change-in-production';

// Demo users (fallback when DB not connected)
const DEMO_USERS = [
  { id: 'demo-1', email: 'ms.simmons@westwood.edu',   passwordHash: bcrypt.hashSync('ALPDemo2026!', 10), firstName: 'Sarah',   lastName: 'Simmons',  role: 'SPECIAL_ED_TEACHER', schoolId: 'school-1', districtId: 'district-1' },
  { id: 'demo-2', email: 'school.admin@westwood.edu', passwordHash: bcrypt.hashSync('ALPDemo2026!', 10), firstName: 'James',   lastName: 'Brown',    role: 'SCHOOL_ADMIN',        schoolId: 'school-1', districtId: 'district-1' },
  { id: 'demo-3', email: 'admin@growwithalp.com',     passwordHash: bcrypt.hashSync('ALPDemo2026!', 10), firstName: 'Stan',    lastName: 'Paraclete',role: 'SUPER_ADMIN',         schoolId: null,       districtId: 'district-1' },
  { id: 'demo-4', email: 'parent@demo.com',           passwordHash: bcrypt.hashSync('ALPDemo2026!', 10), firstName: 'Patricia',lastName: 'Johnson',  role: 'PARENT',              schoolId: 'school-1', districtId: 'district-1' },
];

async function findUser(email) {
  try {
    return await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  } catch {
    return DEMO_USERS.find(u => u.email === email.toLowerCase()) || null;
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await findUser(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, schoolId: user.schoolId },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    let user;
    try { user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id:true, email:true, firstName:true, lastName:true, role:true, schoolId:true } }); }
    catch { user = DEMO_USERS.find(u => u.id === req.user.id); }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => res.json({ message: 'Logged out' }));

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => res.json({ message: 'If that email exists, a reset link has been sent.' }));

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, JWT_SECRET + '_refresh');
    const user = DEMO_USERS.find(u => u.id === decoded.userId);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    res.json(generateTokens(user));
  } catch { res.status(401).json({ error: 'Invalid refresh token' }); }
});

export default router;
