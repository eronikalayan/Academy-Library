import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanRepository } from '../../../shared/data/loans';

/** No optimistic update — borrowing can fail for reasons only the
 * server knows about at the moment of the request (no copies left,
 * already have an active loan for this title), so the toggle must wait
 * for a real confirmation, same reasoning as every other mutation in
 * this app that touches shared, contended state (see
 * `useAddCollectionResourceMutation`). Invalidates `inventory` (a
 * copy's status just flipped), `loans` (a new loan exists), and
 * `dashboard` (`activeLoansCount` just changed). */
export function useBorrowResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) => loanRepository.borrow(resourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['loans'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
