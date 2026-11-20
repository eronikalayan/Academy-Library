import type { CookieOptions, Request } from 'express';
import { cookieSameSite, env } from '../config/env.js';

const isProduction = env.NODE_ENV === 'production';

/**
 * Shared cookie attributes for every cookie this API sets (the session
 * cookie, the CSRF secret cookie, the anonymous CSRF-scope cookie).
 *
 * - `httpOnly: true` — never readable from JavaScript; the only thing
 *   that can read a session token is this server.
 * - `secure` is tied to `NODE_ENV === 'production'`, not a per-request
 *   HTTPS check: this assumes `NODE_ENV=production` is only ever set for
 *   a deployment actually served over HTTPS (directly, or via a
 *   TLS-terminating reverse proxy with `trust proxy` configured, which
 *   `app.ts` already sets). Never set `NODE_ENV=production` for a
 *   plain-HTTP deployment — the browser will silently refuse to send the
 *   cookie back and every authenticated request will look like a fresh,
 *   logged-out one. See docs/architecture/authentication.md ("Cookie
 *   policy") for how this plays out in the bundled Docker Compose stack,
 *   which is a local topology mirror, not a TLS-terminated deployment.
 * - `sameSite: 'lax'` by default — sufficient (not merely
 *   assumed-sufficient) given the explicit "no cross-site cookie"
 *   deployment shape documented above: both local dev (via the Vite
 *   proxy), the Compose/production shape (via the nginx reverse proxy),
 *   and the recommended free-hosting topology (via Vercel rewrites —
 *   see docs/deployment/free-hosting.md) put the browser and the API on
 *   one origin, so this is never actually a cross-site request in the
 *   first place. CSRF protection (src/middleware/csrf.ts) is still
 *   applied on top — SameSite alone is not treated as sufficient CSRF
 *   protection, only as a sensible scope restriction on the cookie
 *   itself. Overridable via `COOKIE_SAME_SITE` (src/config/env.ts) for a
 *   deliberately-unproxied cross-origin deployment, which genuinely
 *   needs `'none'`.
 * - `secure` is additionally forced `true` whenever `sameSite` is
 *   `'none'`, regardless of `NODE_ENV` — browsers reject `SameSite=None`
 *   cookies outright without `Secure`, so this fails loud (cookies
 *   simply won't be set without HTTPS) rather than failing quiet.
 * - `path: '/'` — explicit, not left to the default-from-request-path
 *   behavior.
 */
export const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction || cookieSameSite === 'none',
  sameSite: cookieSameSite,
  path: '/',
};

export const SESSION_COOKIE_NAME = env.SESSION_COOKIE_NAME;

/** `cookie-parser` types `req.cookies` as `any` (it has no way to know
 * the shape) — this is the one place that casts it, to a precise
 * `Record<string, string | undefined>`, so every call site gets a
 * type-checked read instead of its own unsafe member access. */
export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name];
}
