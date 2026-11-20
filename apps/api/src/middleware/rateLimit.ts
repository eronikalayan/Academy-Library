import rateLimit from 'express-rate-limit';
import type { ApiErrorResponse } from '@academy-library/contracts';
import { env } from '../config/env.js';

/**
 * Throttles the credential-guessing surface (`POST /login`) and the
 * account-enumeration/spam surface (`POST /register`) by IP.
 *
 * Uses `express-rate-limit`'s default in-memory store — process-local
 * counters that reset on restart and are NOT shared across multiple API
 * instances/processes. That's fine for this single-instance deployment,
 * but means limits are effectively per-instance, not per-deployment,
 * the moment there is more than one: an attacker spread across N
 * instances (behind a naive round-robin load balancer, say) gets N times
 * this limit in practice. Before running more than one API replica,
 * swap the `store` option for a shared backing store (e.g.
 * `rate-limit-redis` against a real Redis instance) — see
 * docs/architecture/authentication.md ("Known limitations").
 *
 * IP-based keying (the default, respecting `trust proxy`) is a first
 * layer, not account lockout — it slows down brute-forcing from one
 * network, not a distributed attempt against one specific account. See
 * the same docs section for why account-level lockout is a deliberate
 * Task 05B recommendation, not an oversight here.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // This is one shared, module-level (process-lifetime) counter per IP —
  // deliberately so, in production, so it actually limits across every
  // request the process handles rather than resetting per request. That
  // same property makes it unsuitable to leave enabled for the
  // functional integration suite: tests share one `createApp()` instance
  // for the whole file (see tests/auth.routes.test.ts), so hits from
  // unrelated earlier tests would accumulate and start 429-ing later
  // ones for reasons that have nothing to do with what that test is
  // actually checking. Rate-limiting itself is verified separately,
  // against its own isolated limiter instance — see
  // tests/rateLimit.test.ts.
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res) => {
    const requestId = typeof req.id === 'string' ? req.id : undefined;
    const body: ApiErrorResponse = {
      error: {
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMITED',
        requestId,
      },
    };
    res.status(429).json(body);
  },
});
