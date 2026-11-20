import type { FieldPath, UseFormSetError } from 'react-hook-form';
import { isApiError } from '../../shared/api/ApiError';

/** User-facing copy for the Library Explorer's list error state. Never
 * echoes `error.message` directly for a non-`ApiError` (a raw
 * `TypeError: Failed to fetch` is not something to show a user), and
 * only echoes it for the one `ApiError` case where the backend's own
 * message is itself already user-appropriate. */
export function getResourceListErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return "Couldn't reach the library. Check your connection and try again.";
  }
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'That search or filter combination is not valid.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return 'Something went wrong while loading the library.';
  }
}

/** Same shape as `getResourceListErrorMessage`, for the detail page. A
 * `404` never reaches this — `HttpResourceRepository.getById` resolves
 * `null` for that case, which `ResourceDetailsPage` already renders as
 * its own dedicated "not found" state, not this error path. */
export function getResourceDetailErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return "Couldn't reach this resource. Check your connection and try again.";
  }
  switch (error.code) {
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return 'Something went wrong while loading this resource.';
  }
}

interface FlattenedZodDetails {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

function isFlattenedZodDetails(details: unknown): details is FlattenedZodDetails {
  return typeof details === 'object' && details !== null;
}

function isInvalidIdsDetails(
  details: unknown,
): details is { invalidCourseIds?: string[]; invalidGroupIds?: string[] } {
  return typeof details === 'object' && details !== null;
}

/**
 * Top-of-form copy for a create/update/delete failure. Two distinct 400
 * codes can come back here, not one: a raw `ZodError` (missing/malformed
 * field — e.g. no title) is `VALIDATION_ERROR` with a `.flatten()`
 * payload `applyServerFieldErrors` below maps onto specific fields; a
 * *business-rule* rejection (an unknown `courseId`/`restrictedToGroupIds`
 * entry, or a duration/type mismatch — `resource.service.ts`'s
 * `AppError.badRequest` calls) is `BAD_REQUEST` with its own
 * `details.invalidCourseIds`/`invalidGroupIds`, never the flattened
 * shape — surfaced here as a specific message instead of a generic one,
 * since "please correct the highlighted fields" would be actively
 * misleading when no single form field is highlighted at all (the
 * course/group picker's *options* are simply listing something that no
 * longer exists, not something the field-level validator rejected).
 */
export function getResourceMutationErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'Please correct the highlighted fields.';
    case 'BAD_REQUEST':
      if (isInvalidIdsDetails(error.details)) {
        if (error.details.invalidCourseIds?.length) {
          return 'One or more selected courses no longer exist. Please update your selection.';
        }
        if (error.details.invalidGroupIds?.length) {
          return 'One or more selected groups no longer exist. Please update your selection.';
        }
      }
      return error.message || 'That combination of fields is not valid for this resource type.';
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again and retry.';
    case 'FORBIDDEN':
      return "You don't have permission to do that.";
    case 'NOT_FOUND':
      return 'This resource no longer exists. It may have just been deleted.';
    case 'INVALID_CSRF_TOKEN':
      return 'Your session expired. Please refresh the page and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/** Maps a `VALIDATION_ERROR` response's `details.fieldErrors` onto React
 * Hook Form field errors — the same mechanism as
 * `features/auth/authErrors.ts`'s `applyServerFieldErrors`, lifted here
 * rather than imported from there since nothing about it is
 * auth-specific; it only matters when the client's own `zodResolver`
 * validation passes but the server still rejects the payload (the two
 * schemas briefly disagreeing), not the primary validation path. */
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
