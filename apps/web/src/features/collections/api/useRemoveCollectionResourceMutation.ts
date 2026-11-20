import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionRepository } from '../../../shared/data/collections';

export interface RemoveCollectionResourceVariables {
  collectionId: string;
  resourceId: string;
}

/** No optimistic removal — per the task brief's "no unsafe optimistic
 * updates for destructive operations," same as
 * `useDeleteResourceMutation`/`useDeleteCollectionMutation`. */
export function useRemoveCollectionResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, resourceId }: RemoveCollectionResourceVariables) =>
      collectionRepository.removeResource(collectionId, resourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
