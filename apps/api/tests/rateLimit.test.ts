import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authRateLimiter } from '../src/middleware/rateLimit.js';

interface RateLimitedErrorBody {
  error: { code: string };
}

function isRateLimitedErrorBody(body: unknown): body is RateLimitedErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'code' in body.error
  );
}

/**
 * Deliberately not testing `authRateLimiter` by hammering the real app
 * (see the comment on it in src/middleware/rateLimit.ts, and the note at
 * the top of tests/auth.routes.test.ts) — that limiter is a shared,
 * process-lifetime counter, so bending it to a small enough limit to
 * test quickly would make it useless for the rest of the suite. Instead:
 * a fresh, isolated instance with the same shape proves the mechanism
 * works, and a separate test confirms the *real* limiter's `skip` rule
 * is what keeps it out of the way during tests.
 */
function buildAppWithLimiter(limit: number) {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { message: 'Too many requests', code: 'RATE_LIMITED' } });
    },
  });
  app.get('/throttled', limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('rate limiting mechanism', () => {
  it('allows requests up to the limit', async () => {
    const app = buildAppWithLimiter(3);

    for (let i = 0; i < 3; i += 1) {
      const response = await request(app).get('/throttled');
      expect(response.status).toBe(200);
    }
  });

  it('rejects requests past the limit with 429 and the shared error shape', async () => {
    const app = buildAppWithLimiter(3);

    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/throttled');
    }
    const response = await request(app).get('/throttled');

    expect(response.status).toBe(429);
    expect(isRateLimitedErrorBody(response.body) && response.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('authRateLimiter', () => {
  it('skips enforcement entirely when NODE_ENV=test (as it is for this whole suite)', async () => {
    const app = express();
    app.get('/auth-like', authRateLimiter, (_req, res) => res.status(200).json({ ok: true }));

    // Comfortably past the real limiter's configured `limit` — if `skip`
    // weren't working, this would start 429ing partway through, which is
    // exactly the bug that made tests/auth.routes.test.ts flaky before
    // `skip` was added.
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app).get('/auth-like');
      expect(response.status).toBe(200);
    }
  });
});
