import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { bookmarkRepository } from '../../../shared/data/bookmarks';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/**
 * Derives "is this resource currently saved by me" from a dedicated,
 * per-resource status check (`GET /bookmarks/:resourceId/status`) —
 * accurate regardless of how many resources the caller has saved in
 * total. Task 06's original version answered this from the same cached
 * `['bookmarks','list',...]` query `SavedPage` renders, capped at its
 * largest allowed page size (60) — correct only for a caller's first 60
 * saved resources, silently wrong beyond that. Fixed (Task 07) by
 * asking the one question this hook actually needs answered, in O(1),
 * instead of inferring it from a page of a different, larger answer.
 *
 * Keyed under the `['bookmarks', ...]` prefix so `useSaveResourceMutation`/
 * `useUnsaveResourceMutation`'s existing `invalidateQueries({queryKey:
 * ['bookmarks']})` already invalidates this query too, with no change
 * needed on the mutation side.
 */
export function useIsResourceSaved(resourceId: string | undefined) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  const { data, isPending } = useQuery({
    queryKey: ['bookmarks', 'status', user?.id ?? 'anonymous', resourceId],
    queryFn: ({ signal }) => bookmarkRepository.status(resourceId as string, signal),
    enabled: !isAuthLoading && Boolean(user) && Boolean(resourceId),
    retry: shouldRetryTransientFailure,
  });

  return { isSaved: data?.isSaved ?? false, isPending: isAuthLoading || isPending };
}
