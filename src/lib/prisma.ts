import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  try {
    return new PrismaClient();
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || '';
    if (errorMsg.includes('did not initialize yet') || errorMsg.includes('prisma generate')) {
      // Direct fallback to generated client package
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const direct = require('.prisma/client');
      return new direct.PrismaClient();
    }
    throw err;
  }
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
