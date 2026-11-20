import {
  AuthResponseSchema,
  LoginInputSchema,
  RegisterInputSchema,
  type AuthResponse,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
} from '@academy-library/contracts';
import { apiRequest } from '../../../shared/api/httpClient';
import { ApiError } from '../../../shared/api/ApiError';

/**
 * Thin, typed wrappers over the four endpoints `apps/api` already
 * exposes (`docs/architecture/authentication.md`, "API endpoints") — no
 * field or behavior here that endpoint doesn't actually implement.
 * `LoginInputSchema`/`RegisterInputSchema` are reused directly from
 * `@academy-library/contracts` for the *request* shape, so the client
 * can never drift from what the server actually accepts.
 */

// `async`, not a plain function returning `apiRequest(...)`'s promise —
// `LoginInputSchema.parse`/`RegisterInputSchema.parse` can throw
// *synchronously*, and only an `async` function turns that into a
// rejected promise automatically. Without it, a caller doing
// `login(input).catch(...)` would never reach `.catch` for a validation
// failure — it would throw straight out of the `login(...)` call
// instead, defeating every consumer's promise-based error handling
// (mutations, `await` + `try/catch`, this file's own tests).

export async function login(input: LoginInput): Promise<AuthResponse> {
  const body = LoginInputSchema.parse(input);
  return apiRequest('/auth/login', (data) => AuthResponseSchema.parse(data), {
    method: 'POST',
    body,
  });
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const body = RegisterInputSchema.parse(input);
  return apiRequest('/auth/register', (data) => AuthResponseSchema.parse(data), {
    method: 'POST',
    body,
  });
}

export function logout(): Promise<void> {
  return apiRequest('/auth/logout', () => undefined, { method: 'POST' });
}

/**
 * `null` means "confirmed not logged in" (the server said `401`) — a
 * normal, expected outcome for an anonymous visitor, not an error.
 * Anything else that goes wrong (network failure, `500`, …) is left to
 * throw, so a genuine problem still surfaces as a query error instead of
 * being silently treated as "logged out". See `useCurrentUser.ts` for
 * how the two are told apart by callers.
 */
export async function fetchCurrentUser(): Promise<PublicUser | null> {
  try {
    const response = await apiRequest('/auth/me', (data) => AuthResponseSchema.parse(data));
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
