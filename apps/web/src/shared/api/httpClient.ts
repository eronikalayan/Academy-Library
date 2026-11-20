import { ApiErrorResponseSchema } from '@academy-library/contracts';
import { ApiError } from './ApiError';
import { clearCsrfToken, getCsrfToken } from './csrfToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * An absolute (`http(s)://`) base URL means the API is served from a
 * different origin than this frontend — the deliberately-unproxied
 * cross-origin fallback (see docs/deployment/free-hosting.md), paired
 * on the API side with `COOKIE_SAME_SITE=none` (src/config/env.ts).
 * Fetch's `'same-origin'` credentials mode would silently never send
 * the session cookie in that case, so `'include'` is required instead.
 * The default — a relative path, and the recommended Vercel-rewrite
 * topology — stays `'same-origin'`, the stricter and correct choice
 * there (see `apiRequest`'s own doc comment). Deriving this from the
 * same `VITE_API_BASE_URL` that already decides the request URL means
 * there's no second flag that could drift out of sync with it.
 */
const IS_CROSS_ORIGIN_API = /^https?:\/\//i.test(API_BASE_URL);
const CREDENTIALS_MODE: RequestCredentials = IS_CROSS_ORIGIN_API ? 'include' : 'same-origin';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

async function toApiError(response: Response): Promise<ApiError> {
  let rawBody: unknown = null;
  try {
    rawBody = await response.json();
  } catch {
    // No/invalid JSON body (e.g. a proxy error page) — fall through to
    // the generic envelope below rather than throwing while building an
    // error.
  }

  const parsed = ApiErrorResponseSchema.safeParse(rawBody);
  if (parsed.success) {
    if (parsed.data.error.code === 'INVALID_CSRF_TOKEN') {
      clearCsrfToken();
    }
    return new ApiError(response.status, parsed.data);
  }

  // Never surface whatever unexpected body came back (could be an HTML
  // error page from an intermediary) — a safe, generic message instead.
  return new ApiError(response.status, {
    error: { message: 'Something went wrong. Please try again.', code: 'UNKNOWN_ERROR' },
  });
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Propagated straight to `fetch` — TanStack Query passes its own
   * per-query signal into `queryFn`, aborted when a query is cancelled
   * (component unmount, or a newer request superseding an in-flight one
   * with the same key, e.g. fast pagination/filter changes). Optional:
   * callers outside a query (none today) simply omit it. */
  signal?: AbortSignal;
}

/**
 * The one place every API call in this app goes through.
 *
 * - `credentials` is explicit, not relied on as a fetch default: this
 *   app's cookie-session design is built around the frontend and API
 *   being same-origin (the Vite dev proxy locally, the nginx reverse
 *   proxy in Docker/production, the recommended Vercel-rewrite proxy in
 *   the free-hosting topology — see docs/architecture/authentication.md,
 *   "Cookie policy"), where `'same-origin'` is correct. `CREDENTIALS_MODE`
 *   above switches to `'include'` automatically when `VITE_API_BASE_URL`
 *   points at a different origin — the deliberately-unproxied fallback.
 * - A CSRF token is attached for every method except the safe ones
 *   (`GET`/`HEAD`) — matching the backend's own `ignoredMethods` in
 *   `apps/api/src/middleware/csrf.ts` exactly.
 * - Parses every response body through a caller-supplied Zod schema —
 *   this app never trusts an API response's shape implicitly, the same
 *   discipline `HttpResourceRepository` (apps/web/src/shared/data/
 *   resources) already applies.
 */
export async function apiRequest<T>(
  path: string,
  parse: (data: unknown) => T,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (!SAFE_METHODS.has(method)) {
    headers['x-csrf-token'] = await getCsrfToken();
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: CREDENTIALS_MODE,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return parse(undefined);
  }

  return parse(await response.json());
}
