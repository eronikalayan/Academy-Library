import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ResourceListQuery } from '@academy-library/contracts';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { resourceRepository } from '../../../shared/data/resources';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/**
 * Resource visibility depends on who's asking (see
 * docs/domain/resources.md, "Authorization rules") — an anonymous
 * visitor, a signed-in member of a restricted resource's group, and an
 * `ADMIN` can all get a genuinely different result for the exact same
 * `query`. Including `user?.id` (falling back to the literal string
 * `'anonymous'`) in the key means a different identity is a different
 * cache entry, full stop: logging in, logging out, or switching accounts
 * can never serve a *stale* list cached under a *different* identity —
 * each gets its own entry rather than overwriting or reusing one. This
 * is the primary defense; `useLogoutMutation`'s `queryClient.clear()`
 * (features/auth/api/useLogoutMutation.ts) is the secondary one, for
 * cache growth, not correctness.
 *
 * `enabled: !isAuthLoading` holds this query until the session check
 * resolves, rather than firing once under `'anonymous'` and immediately
 * refetching under the real identity a moment later — the task brief's
 * "avoid unnecessary resource refetches" applies directly here, and
 * firing early would also risk a visible flash of a smaller
 * (public-only) result set for an about-to-be-recognized authenticated
 * user.
 */
export function useResourceListQuery(query: ResourceListQuery) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['resources', 'list', user?.id ?? 'anonymous', query],
    queryFn: ({ signal }) => resourceRepository.list(query, signal),
    enabled: !isAuthLoading,
    // Keeps the previous page's results on screen while a new page/filter
    // combination loads, instead of flashing a skeleton on every change.
    placeholderData: keepPreviousData,
    // `GET /resources` uses `optionalAuth` — it never actually returns a
    // `401`/`403` (an anonymous caller is scoped to `PUBLIC` resources,
    // never rejected), so any `ApiError` reaching this policy is a
    // genuine client-request problem (e.g. an out-of-bounds `pageSize`)
    // or rate limiting; a plain network failure still gets a couple of
    // retries. See `shared/api/retryPolicy.ts`.
    retry: shouldRetryTransientFailure,
  });
}
