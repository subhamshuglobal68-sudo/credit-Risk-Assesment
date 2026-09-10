import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

async function seed() {
  console.log('--- Seeding CREA AI Auth Database ---');

  const adminPasswordHash = await bcrypt.hash('Admin@CreaAI2026!', 12);
  const userPasswordHash = await bcrypt.hash('User@CreaAI2026!', 12);

  // 1. Seed Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crea-ai.com' },
    update: {
      role: 'ADMIN',
      isVerified: true,
      twoFactorEnabled: true,
      passwordHash: adminPasswordHash,
      name: 'CREA Super Admin',
    },
    create: {
      email: 'admin@crea-ai.com',
      name: 'CREA Super Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isVerified: true,
      twoFactorEnabled: true,
      authProvider: 'EMAIL',
    },
  });
  console.log(`[SEED] Admin account ready: ${admin.email} (role: ${admin.role}, 2FA: mandatory)`);

  // 2. Seed Regular User
  const user = await prisma.user.upsert({
    where: { email: 'user@crea-ai.com' },
    update: {
      role: 'USER',
      isVerified: true,
      twoFactorEnabled: false,
      passwordHash: userPasswordHash,
      name: 'Jane Doe',
    },
    create: {
      email: 'user@crea-ai.com',
      name: 'Jane Doe',
      passwordHash: userPasswordHash,
      role: 'USER',
      isVerified: true,
      twoFactorEnabled: false,
      authProvider: 'EMAIL',
    },
  });
  console.log(`[SEED] Regular user account ready: ${user.email} (role: ${user.role})`);
  console.log('--- Database seeding completed successfully ---');
}

seed()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
