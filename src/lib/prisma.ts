import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient instance for the entire app.
 * Creating multiple instances (e.g. per controller) exhausts the DB connection pool
 * and causes "MaxClientsInSessionMode: max clients reached" on Render/small Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
