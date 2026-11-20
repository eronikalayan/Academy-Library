import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resourceRepository } from '../../../shared/data/resources';

/**
 * No optimistic removal from any cached list — a destructive mutation
 * only changes what the UI shows *after* the server has actually
 * confirmed the deletion, never before (per the task brief's "no unsafe
 * optimistic updates for destructive operations"). Until `onSuccess`
 * fires, the resource stays exactly as visible as it was; a failed
 * delete leaves every cache untouched, so there's nothing to roll back.
 */
export function useDeleteResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resourceRepository.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}
