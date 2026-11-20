import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryRepository } from '../../../shared/data/inventory';

export interface RegisterCopyVariables {
  resourceId: string;
  inventoryCode: string;
}

export function useRegisterCopyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ resourceId, inventoryCode }: RegisterCopyVariables) =>
      inventoryRepository.registerCopy(resourceId, inventoryCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
