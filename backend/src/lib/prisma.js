import { PrismaClient } from '@prisma/client';

const prisma = globalThis.__linkfoldPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__linkfoldPrisma = prisma;
}

export default prisma;
