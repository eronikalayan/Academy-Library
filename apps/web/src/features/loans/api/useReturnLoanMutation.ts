import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanRepository } from '../../../shared/data/loans';

export function useReturnLoanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loanId: string) => loanRepository.returnLoan(loanId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['loans'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
