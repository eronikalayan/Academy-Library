import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionRepository } from '../../../shared/data/collections';

export interface AddCollectionResourceVariables {
  collectionId: string;
  resourceId: string;
}

/** No optimistic insert — adding a resource re-fetches/invalidates
 * only after the server confirms it, so a resource the server
 * ultimately rejects (e.g. one the caller can't actually see) never
 * flashes into the list first. */
export function useAddCollectionResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, resourceId }: AddCollectionResourceVariables) =>
      collectionRepository.addResource(collectionId, resourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
