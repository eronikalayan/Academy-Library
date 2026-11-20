import { useQuery } from '@tanstack/react-query';
import type { LoanListQuery } from '@academy-library/contracts';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { loanRepository } from '../../../shared/data/loans';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** Keyed by `user?.id`, same reasoning as `useBookmarksQuery` — a
 * user's own loan list must never survive a login/logout across
 * identities in the cache. */
export function useMyLoansQuery(query: LoanListQuery) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['loans', 'mine', user?.id ?? 'anonymous', query],
    queryFn: ({ signal }) => loanRepository.listMine(query, signal),
    enabled: !isAuthLoading,
    retry: shouldRetryTransientFailure,
  });
}
