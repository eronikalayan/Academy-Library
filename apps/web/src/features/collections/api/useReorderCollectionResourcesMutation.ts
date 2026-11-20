import { useMutation, useQueryClient } from '@tanstack/react-query';

import { collectionRepository } from '../../../shared/data/collections';

export interface ReorderCollectionResourcesVariables {
  collectionId: string;
  resourceIds: string[];
}

/**
 * No optimistic reorder — the Up/Down controls disable themselves
 * while a reorder is in flight (see `CollectionDetailsPage`), so the
 * UI reads as "working," not "stuck," without needing to predict the
 * server's result ahead of confirmation. Keeping every mutation in
 * this module invalidate-then-refetch, rather than mixing optimistic
 * and non-optimistic strategies across them, is the simpler, more
 * predictable choice given this domain's one genuinely tricky
 * concurrency case already lives server-side (see
 * `collection.repository.ts`'s row-locked reorder).
 */
export function useReorderCollectionResourcesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, resourceIds }: ReorderCollectionResourcesVariables) =>
      collectionRepository.reorderResources(collectionId, { resourceIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
