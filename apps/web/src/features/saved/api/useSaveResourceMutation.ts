import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarkRepository } from '../../../shared/data/bookmarks';

/**
 * Plain invalidate-then-refetch, not an optimistic update — per the
 * task brief's own fallback ("optimistic updates only if rollback and
 * cache synchronization are handled correctly; otherwise use
 * invalidation"). The bookmarks list is read from more than one place
 * at once (`SavedPage` and every `useIsResourceSaved` check on a
 * resource card/detail page), all sharing one cache entry per page
 * size — synthesizing a correct optimistic `Bookmark` row (which needs
 * a full `ResourceSummary`, not just a `resourceId`) and rolling it
 * back correctly on failure across every one of those call sites is
 * real complexity this task's save/unsave toggle doesn't need to take
 * on for a plain invalidation to already feel instant in practice
 * (the mutation itself is a single small request).
 */
export function useSaveResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) => bookmarkRepository.save({ resourceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
