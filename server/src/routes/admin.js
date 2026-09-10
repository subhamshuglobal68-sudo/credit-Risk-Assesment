import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = Router();

// Protect ALL admin routes with both JWT verification and ADMIN role check
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

const CreateAdminSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
});

// 1. List all users (Admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        authProvider: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalUsers = users.length;
    const adminCount = users.filter((u) => u.role === 'ADMIN').length;
    const verifiedCount = users.filter((u) => u.isVerified).length;

    return res.status(200).json({
      metrics: {
        totalUsers,
        adminCount,
        verifiedCount,
      },
      users,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Create Admin (Super-admin only)
router.post('/create-admin', async (req, res) => {
  try {
    const validated = CreateAdminSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      if (existing.role === 'ADMIN') {
        return res.status(409).json({ error: 'An admin account with this email already exists.' });
      }
      // Upgrade existing user to ADMIN
      const upgraded = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'ADMIN',
          isVerified: true,
          twoFactorEnabled: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });

      return res.status(200).json({
        message: `User ${existing.email} was successfully elevated to ADMIN.`,
        admin: upgraded,
      });
    }

    const passwordHash = await bcrypt.hash(validated.password, 12);
    const newAdmin = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name || 'Admin',
        passwordHash,
        role: 'ADMIN',
        isVerified: true,
        twoFactorEnabled: true,
        authProvider: 'EMAIL',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: 'New Admin account created successfully.',
      admin: newAdmin,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

export default router;
