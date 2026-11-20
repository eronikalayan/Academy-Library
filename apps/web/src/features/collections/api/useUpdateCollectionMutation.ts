import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CollectionUpdateInput } from '@academy-library/contracts';
import { collectionRepository } from '../../../shared/data/collections';

export interface UpdateCollectionVariables {
  id: string;
  input: CollectionUpdateInput;
}

export function useUpdateCollectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateCollectionVariables) =>
      collectionRepository.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
