/**
 * ALP Platform — Auth Middleware
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alp-dev-secret-change-in-production';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
      schoolId: decoded.schoolId,
      districtId: decoded.districtId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    next();
  };
}

export function generateTokens(user) {
  const payload = { userId: user.id, email: user.email, role: user.role, schoolId: user.schoolId, districtId: user.districtId };
  const accessToken  = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET + '_refresh', { expiresIn: '30d' });
  return { accessToken, refreshToken };
}
