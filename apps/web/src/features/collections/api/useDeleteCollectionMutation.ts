import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionRepository } from '../../../shared/data/collections';

/** No optimistic removal — same "destructive mutations only change the
 * cache after the server confirms it" rule as `useDeleteResourceMutation`. */
export function useDeleteCollectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionRepository.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
