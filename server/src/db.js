import { PrismaClient } from '@prisma/client';

let prismaInstance;

export function getPrisma() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = new Proxy({}, {
  get(target, prop) {
    const client = getPrisma();
    return client[prop];
  }
});
