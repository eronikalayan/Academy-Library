import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CollectionListQuery } from '@academy-library/contracts';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { collectionRepository } from '../../../shared/data/collections';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/**
 * Same auth-aware key/`enabled` strategy as `useResourceListQuery` —
 * `user?.id` is part of the key because collection visibility (and
 * each item's own `resourceCount`) genuinely differs by who's asking,
 * not just as a cache-growth nicety. `GET /collections` requires a
 * real session (unlike Resources' `optionalAuth` reads — see
 * `collection.policy.ts`), so this hook is only ever meaningfully
 * called from inside the authenticated app shell; `enabled` still
 * waits for the session check regardless, for the same "don't fire
 * once under the wrong identity" reason.
 */
export function useCollectionListQuery(query: CollectionListQuery) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['collections', 'list', user?.id ?? 'anonymous', query],
    queryFn: ({ signal }) => collectionRepository.list(query, signal),
    enabled: !isAuthLoading,
    placeholderData: keepPreviousData,
    retry: shouldRetryTransientFailure,
  });
}
