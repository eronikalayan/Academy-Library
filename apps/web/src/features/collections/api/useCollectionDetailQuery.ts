import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { collectionRepository } from '../../../shared/data/collections';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** Same auth-aware key/`enabled` strategy as `useResourceDetailQuery` —
 * a `RESTRICTED` collection's detail, and which resource items it
 * contains, genuinely differs by who's asking. */
export function useCollectionDetailQuery(collectionId: string | undefined) {
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();

  return useQuery({
    queryKey: ['collections', 'detail', user?.id ?? 'anonymous', collectionId],
    queryFn: ({ signal }) => collectionRepository.getById(collectionId as string, signal),
    enabled: Boolean(collectionId) && !isAuthLoading,
    retry: shouldRetryTransientFailure,
  });
}
