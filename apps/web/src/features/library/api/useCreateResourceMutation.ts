import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResourceCreateInput } from '@academy-library/contracts';
import { resourceRepository } from '../../../shared/data/resources';

/**
 * Invalidates every `['resources', ...]` query (list *and* detail,
 * across every signed-in identity's own cache entries — see
 * `useResourceListQuery.ts`'s key strategy) rather than trying to
 * predict which specific list/filter/sort combination a newly created
 * resource should now appear in: its title/type/tags/course
 * associations could affect any number of already-cached search
 * results, so a precise patch would have to reimplement the backend's
 * own filtering logic just to decide where to insert it. A broad
 * invalidation is simple, correct, and the one approach that can't
 * silently leave a stale list behind.
 */
export function useCreateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ResourceCreateInput) => resourceRepository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}
