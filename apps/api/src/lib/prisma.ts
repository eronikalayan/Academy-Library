import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Reuse a single client across module reloads in dev to avoid exhausting
// the Postgres connection pool when tsx watch reloads the process.
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}
