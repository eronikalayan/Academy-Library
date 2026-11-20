import { useQuery } from '@tanstack/react-query';
import type { LoanListQuery } from '@academy-library/contracts';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { loanRepository } from '../../../shared/data/loans';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** ADMIN-only system-wide listing — backs the "Manage Loans" admin
 * page. The backend itself re-checks the role on every request (see
 * `physicalLibrary.policy.ts`'s `canManageLibrary`); this hook is only
 * ever mounted behind `RequireRole roles={['ADMIN']}` already, same as
 * every other admin page's own data hooks. */
export function useAllLoansQuery(query: LoanListQuery) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['loans', 'all', user?.id ?? 'anonymous', query],
    queryFn: ({ signal }) => loanRepository.listAll(query, signal),
    enabled: !isAuthLoading,
    retry: shouldRetryTransientFailure,
  });
}
