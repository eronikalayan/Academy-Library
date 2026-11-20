import type { FieldPath, UseFormSetError } from 'react-hook-form';
import { isApiError } from '../../shared/api/ApiError';

interface FlattenedZodDetails {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

function isFlattenedZodDetails(details: unknown): details is FlattenedZodDetails {
  return typeof details === 'object' && details !== null;
}

/**
 * A single, generic, top-of-form message for any login/register
 * failure. Deliberately generic for bad credentials — `'UNAUTHORIZED'`
 * always renders the same "Invalid email or password," never anything
 * that could tell an attacker whether the email exists, matching the
 * backend's own anti-enumeration design for `POST /auth/login` (see
 * docs/architecture/authentication.md) rather than quietly undoing it
 * on the client with a more specific message.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
      return 'Invalid email or password.';
    case 'FORBIDDEN':
      return error.message || 'This account is not able to sign in right now.';
    case 'CONFLICT':
      return error.message || 'An account with this email already exists.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'VALIDATION_ERROR':
      return 'Please correct the highlighted fields.';
    case 'INVALID_CSRF_TOKEN':
      return 'Your session expired. Please refresh the page and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Maps a `VALIDATION_ERROR` response's `details.fieldErrors` (a Zod
 * `.flatten()` result — see `apps/api/src/middleware/errorHandler.ts`)
 * onto React Hook Form field errors. Only matters when a submission
 * passes this form's own `zodResolver` validation but the server still
 * rejects it — client and server both validate with the same
 * `RegisterInputSchema`/`LoginInputSchema`, so this is a defensive
 * fallback for the two schemas briefly disagreeing, not the primary
 * validation path.
 */
export function applyServerFieldErrors<TFieldValues extends Record<string, unknown>>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
): void {
  if (!isApiError(error) || error.code !== 'VALIDATION_ERROR') return;
  if (!isFlattenedZodDetails(error.details)) return;

  for (const [field, messages] of Object.entries(error.details.fieldErrors ?? {})) {
    const message = messages?.[0];
    if (message) {
      setError(field as FieldPath<TFieldValues>, { type: 'server', message });
    }
  }
}
