import { useQuery } from '@tanstack/react-query';
import { inventoryRepository } from '../../../shared/data/inventory';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';

/** Not auth-aware-keyed the way most list queries in this app are
 * (compare `useCollectionListQuery`) — copy visibility already tracks
 * the underlying resource's own visibility one-to-one (see
 * `physicalLibrary.service.ts`), so by the time this hook is called the
 * caller has already confirmed via `useResourceDetailQuery` that this
 * resource is visible to them; there is no separate "logged out vs.
 * logged in" distinction this query itself needs to make. */
export function useBookCopiesQuery(resourceId: string | undefined) {
  return useQuery({
    queryKey: ['inventory', 'copies', resourceId],
    queryFn: ({ signal }) => inventoryRepository.listCopies(resourceId as string, signal),
    enabled: Boolean(resourceId),
    retry: shouldRetryTransientFailure,
  });
}
