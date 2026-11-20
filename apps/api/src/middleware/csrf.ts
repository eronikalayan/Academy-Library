import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { env } from '../config/env.js';
import { BASE_COOKIE_OPTIONS, readCookie } from '../lib/cookies.js';

const CSRF_SCOPE_COOKIE = 'csrf_scope';

/**
 * CSRF protection is layered on top of the `SameSite=Lax` session cookie,
 * not assumed to be redundant with it (SameSite alone doesn't cover
 * every case — older browsers, and any future change to the deployment
 * shape that stops being strictly same-site). This uses `csrf-csrf`'s
 * signed double-submit cookie pattern: an HttpOnly "secret" cookie plus a
 * plaintext token the client must echo back via the `x-csrf-token`
 * header on state-changing requests — stealing the plaintext token alone
 * (e.g. via a response the attacker can read) isn't enough without the
 * HttpOnly cookie, and stealing the cookie alone (XSS would be needed,
 * since it's HttpOnly) isn't enough without the token.
 *
 * `getSessionIdentifier` binds the token to *something* stable per
 * browser so one visitor's token can't validate against a different
 * visitor's cookie. Once logged in, that's the real session id; before
 * login (registration, login itself) there is no session yet, so
 * `ensureCsrfScope` below establishes a dedicated anonymous identifier
 * the first time any request needs one.
 */
export function ensureCsrfScope(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const existing = readCookie(req, CSRF_SCOPE_COOKIE);
    if (existing) {
      req.csrfScopeId = existing;
      next();
      return;
    }

    const fresh = randomUUID();
    res.cookie(CSRF_SCOPE_COOKIE, fresh, BASE_COOKIE_OPTIONS);
    req.csrfScopeId = fresh;
    next();
  };
}

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => {
    const identifier = req.authSessionId ?? req.csrfScopeId;
    if (!identifier) {
      // Should be unreachable — `ensureCsrfScope` runs before this on
      // every request (see app.ts) — but fail closed, not open, if it
      // somehow isn't wired up.
      throw new Error('CSRF scope not established — is ensureCsrfScope mounted before this?');
    }
    return identifier;
  },
  cookieName: 'csrf_secret',
  cookieOptions: BASE_COOKIE_OPTIONS,
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

export const csrfProtection: RequestHandler = doubleCsrfProtection;

/** `GET /api/v1/auth/csrf-token` — the client's first call, establishing
 * the anonymous CSRF scope and handing back the plaintext token to echo
 * on subsequent writes. */
export function issueCsrfToken(req: Request, res: Response): void {
  const csrfToken = generateCsrfToken(req, res);
  res.status(200).json({ csrfToken });
}
