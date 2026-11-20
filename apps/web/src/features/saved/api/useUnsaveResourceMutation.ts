import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarkRepository } from '../../../shared/data/bookmarks';

/** Same invalidate-then-refetch reasoning as `useSaveResourceMutation`
 * — see that hook's doc comment. No optimistic removal, consistent
 * with every other destructive mutation in this app. */
export function useUnsaveResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) => bookmarkRepository.unsave(resourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
