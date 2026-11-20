import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { corsOrigins } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originFromHeaderValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * A second, independent layer alongside CORS and the CSRF double-submit
 * token (src/middleware/csrf.ts) — not redundant with either:
 *
 * - CORS only controls whether a *browser* is allowed to read the
 *   response via script. It does not stop the request from reaching
 *   this server at all — a non-browser client ignores it entirely.
 * - The CSRF token proves the request came from a page that could read
 *   this API's own token/cookie pair. This check instead asks a more
 *   basic question first: does the request even claim to originate from
 *   one of this app's known origins? A real browser sends `Origin` on
 *   every unsafe-method request (same-origin or not — the Fetch
 *   standard includes it specifically so servers can do this), so a
 *   missing or mismatched `Origin` (falling back to `Referer`) on a
 *   state-changing request is rejected before any CSRF-token work
 *   happens at all.
 */
export function validateOrigin(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin =
      originFromHeaderValue(req.headers.origin) ?? originFromHeaderValue(req.headers.referer);

    if (!origin || !corsOrigins.includes(origin)) {
      next(AppError.forbidden('Request origin is not allowed'));
      return;
    }

    next();
  };
}
