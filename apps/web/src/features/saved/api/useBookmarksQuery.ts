import { useQuery } from '@tanstack/react-query';
import type { BookmarkListQuery } from '@academy-library/contracts';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { bookmarkRepository } from '../../../shared/data/bookmarks';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** Keyed by `user?.id` for the same reason every other identity-aware
 * query in this app is — a bookmark list is inherently per-user, never
 * shared, so a stale cache entry must never survive a login/logout
 * across identities (see `useLogoutMutation`'s `queryClient.clear()`). */
export function useBookmarksQuery(query: BookmarkListQuery) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['bookmarks', 'list', user?.id ?? 'anonymous', query],
    queryFn: ({ signal }) => bookmarkRepository.list(query, signal),
    enabled: !isAuthLoading,
    retry: shouldRetryTransientFailure,
  });
}
