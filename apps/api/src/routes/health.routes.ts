import { Router } from 'express';
import type { HealthResponse, NotReadyResponse, ReadyResponse } from '@academy-library/contracts';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const healthRouter = Router();

const startedAt = Date.now();

healthRouter.get('/health', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(body);
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const body: ReadyResponse = {
      status: 'ok',
      checks: { database: 'ok' },
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(body);
  } catch (error) {
    logger.error({ err: error }, 'Readiness check failed: database unreachable');
    const body: NotReadyResponse = {
      status: 'error',
      checks: { database: 'error' },
      timestamp: new Date().toISOString(),
    };
    res.status(503).json(body);
  }
});
