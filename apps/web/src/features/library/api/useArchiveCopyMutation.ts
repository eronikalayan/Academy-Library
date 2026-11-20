import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryRepository } from '../../../shared/data/inventory';

export interface ArchiveCopyVariables {
  resourceId: string;
  copyId: string;
}

export function useArchiveCopyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ resourceId, copyId }: ArchiveCopyVariables) =>
      inventoryRepository.archiveCopy(resourceId, copyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
