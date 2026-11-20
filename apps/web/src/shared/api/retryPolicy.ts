import { isApiError } from './ApiError';

/**
 * A reusable retry policy for any query whose error path, by
 * construction, only ever sees one of two kinds of failure: a
 * client-request problem (any `4xx` — invalid input, bad credentials,
 * rate limiting) that retrying cannot fix, or a genuine transient
 * failure (the network being unreachable, or a `5xx`) where a couple of
 * retries is the right default — this is what "distinguish an
 * authentication failure from temporary backend unavailability" means
 * in practice for a query, not a special case per caller.
 *
 * This only works because every caller converts an *expected* non-error
 * outcome into real data before this ever runs, rather than leaning on
 * this function to special-case it — `fetchCurrentUser`
 * (`features/auth/api/authApi.ts`) turns a `401` into a successful
 * `null`, and `HttpResourceRepository.getById`
 * (`shared/data/resources/httpResourceRepository.ts`) turns a `404`
 * into the same. Neither a confirmed "logged out" nor a confirmed
 * "not found" is a failure worth retrying in the first place.
 */
export function shouldRetryTransientFailure(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}
