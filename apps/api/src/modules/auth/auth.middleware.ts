import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@academy-library/contracts';
import { AppError } from '../../errors/AppError.js';
import { readCookie, SESSION_COOKIE_NAME } from '../../lib/cookies.js';
import { validateSessionToken } from './session.service.js';
import { toPublicUser } from './user.repository.js';

/**
 * Resolves the session cookie (if any) onto `req.authUser`/
 * `req.authSessionId`. Shared by `optionalAuth`/`requireAuth` so there is
 * exactly one place that decides what counts as "authenticated" —
 * notably, a `DISABLED` user's otherwise-valid session resolves to
 * nothing here, not to an authenticated-but-disabled state some later
 * check would have to remember to handle.
 */
async function resolveAuth(req: Request): Promise<void> {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  if (!token) return;

  const result = await validateSessionToken(token);
  if (!result) return;
  if (result.user.status === 'DISABLED') return;

  req.authUser = toPublicUser(result.user);
  req.authSessionId = result.sessionId;
}

/** Populates `req.authUser` when a valid session is present; otherwise
 * leaves it `undefined` and continues — for routes that behave
 * differently when logged in but don't require it. */
export function optionalAuth(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    resolveAuth(req)
      .then(() => next())
      .catch(next);
  };
}

/** 401s if there is no valid, non-disabled session. Safe to compose after
 * `optionalAuth` (skips re-resolving if already populated) or to use
 * standalone. */
export function requireAuth(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ensure = req.authUser ? Promise.resolve() : resolveAuth(req);
    ensure
      .then(() => {
        if (!req.authUser) {
          next(AppError.unauthorized());
          return;
        }
        next();
      })
      .catch(next);
  };
}

/**
 * 403s if the authenticated user's role isn't one of `allowedRoles`.
 * Must run after `requireAuth` (or `optionalAuth`, though then an
 * anonymous request would 401 here rather than earlier) — this
 * middleware does not itself resolve the session, only authorizes an
 * already-resolved one, keeping "who are you" and "are you allowed"
 * as separate, independently-testable steps.
 *
 * Authorization is decided here, server-side, from the database-backed
 * session's role — never from anything the client claims about itself.
 */
export function requireRole(...allowedRoles: readonly Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
