import { CsrfTokenResponseSchema } from '@academy-library/contracts';

const CSRF_TOKEN_ENDPOINT = `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/auth/csrf-token`;

let cachedToken: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(CSRF_TOKEN_ENDPOINT, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to obtain a CSRF token (status ${response.status})`);
  }
  const body = CsrfTokenResponseSchema.parse(await response.json());
  return body.csrfToken;
}

/**
 * Lazily fetches and caches the CSRF token for the lifetime of this
 * page load — not re-fetched on every login/logout. That is a
 * deliberate choice, not an oversight: the backend's CSRF middleware
 * (`apps/api/src/middleware/csrf.ts`) binds a token to
 * `req.authSessionId ?? req.csrfScopeId`, but `csrfProtection` is
 * mounted globally in `app.ts` *before* any route runs `requireAuth()`/
 * `optionalAuth()` — the only code that ever populates
 * `req.authSessionId`. That means the `authSessionId` half of the
 * fallback can never actually be set at CSRF-validation time, for any
 * route; every token is bound to `csrfScopeId` alone, regardless of
 * login state. Verified directly against the running API: a token
 * fetched anonymously continues to validate for a write request made
 * after logging in, and a token fetched again post-login is
 * byte-for-byte identical to the pre-login one. So there is nothing to
 * invalidate here on login/logout — doing so would just cost an extra
 * round trip for a rotation that doesn't actually happen server-side.
 * See docs/architecture/authentication.md ("Frontend CSRF handling")
 * for the full write-up; this is a documented, intentional mismatch
 * with that doc's original "after login, the real session id is used
 * instead" claim, not a bug in this file.
 */
export function getCsrfToken(): Promise<string> {
  cachedToken ??= fetchCsrfToken();
  return cachedToken;
}

/** Called when a request actually comes back with `INVALID_CSRF_TOKEN`
 * (see httpClient.ts) — e.g. the underlying cookie expired or was
 * cleared — so the *next* write request fetches a fresh one instead of
 * repeating the same failure forever. */
export function clearCsrfToken(): void {
  cachedToken = null;
}
