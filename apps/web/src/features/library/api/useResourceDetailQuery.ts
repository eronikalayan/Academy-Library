import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { resourceRepository } from '../../../shared/data/resources';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/**
 * Same auth-aware cache key reasoning as `useResourceListQuery` — a
 * `RESTRICTED` resource's detail genuinely differs by who's asking
 * (visible vs. a `404`), so the current user's id is part of the key,
 * never just `resourceId` alone. `enabled` additionally waits for the
 * session check to resolve, for the same "don't fetch once as anonymous
 * and immediately refetch as the real identity" reason.
 */
export function useResourceDetailQuery(resourceId: string | undefined) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['resources', 'detail', user?.id ?? 'anonymous', resourceId],
    queryFn: ({ signal }) => resourceRepository.getById(resourceId as string, signal),
    enabled: Boolean(resourceId) && !isAuthLoading,
    // `getById` already turns a `404` (not found, or inaccessible) into
    // a successful `null` — any `ApiError` that reaches this policy is a
    // genuine problem, not an expected outcome. See
    // `shared/api/retryPolicy.ts`.
    retry: shouldRetryTransientFailure,
  });
}
