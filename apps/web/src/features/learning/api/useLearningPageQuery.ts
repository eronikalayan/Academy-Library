import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { learningRepository } from '../../../shared/data/learning';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** Keyed by `user?.id` — recommendations in particular are derived from
 * this specific viewer's own saved resources, never shared across
 * identities in the cache. */
export function useLearningPageQuery() {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['learning', user?.id ?? 'anonymous'],
    queryFn: ({ signal }) => learningRepository.getLearningPage(signal),
    enabled: !isAuthLoading,
    retry: shouldRetryTransientFailure,
  });
}
