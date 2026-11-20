import type { ApiErrorResponse } from '@academy-library/contracts';

/**
 * The one shape every failed API call throws as — built from the
 * backend's existing error envelope (`ApiErrorResponseSchema`,
 * `packages/contracts/src/error.ts`), never a raw `Response` or a
 * hand-parsed body at the call site. `code` is what callers branch on
 * (`'UNAUTHORIZED'`, `'CONFLICT'`, `'VALIDATION_ERROR'`, ...) — see
 * `features/auth/authErrors.ts` for the mapping to user-facing copy.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorResponse) {
    super(body.error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
    this.requestId = body.error.requestId;
  }
}

/** Narrows `unknown` (e.g. from a `catch` block or a TanStack Query
 * `error`) down to `ApiError` without an unsafe cast. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
