import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CollectionCreateInput } from '@academy-library/contracts';
import { collectionRepository } from '../../../shared/data/collections';

/** Broad `['collections']` invalidation on success — same reasoning as
 * `useCreateResourceMutation`: a precise patch would have to predict
 * every already-cached list/filter combination a new collection could
 * now affect. */
export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CollectionCreateInput) => collectionRepository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
