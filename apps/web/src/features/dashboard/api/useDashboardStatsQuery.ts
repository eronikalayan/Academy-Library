import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { dashboardRepository } from '../../../shared/data/dashboard';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** Keyed by `user?.id`, same reasoning as every other per-viewer query
 * in this app (`useBookmarksQuery`, `useMyLoansQuery`) — every number on
 * this page is this specific user's own authorization-aware view, never
 * shared across identities in the cache. */
export function useDashboardStatsQuery() {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['dashboard', user?.id ?? 'anonymous'],
    queryFn: ({ signal }) => dashboardRepository.getStats(signal),
    enabled: !isAuthLoading,
    retry: shouldRetryTransientFailure,
  });
}
