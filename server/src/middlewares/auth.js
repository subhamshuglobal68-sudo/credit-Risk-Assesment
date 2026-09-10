import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { prisma } from '../db.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid access token.' });
  }
}

export function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        error: `Access denied. ${requiredRole} privileges are required for this action.`,
      });
    }

    next();
  };
}

export function requireVerified(req, res, next) {
  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({
      error: 'Email verification required to access this resource.',
      code: 'VERIFICATION_REQUIRED',
    });
  }
  next();
}
