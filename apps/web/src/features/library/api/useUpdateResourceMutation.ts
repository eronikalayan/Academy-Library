import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResourceUpdateInput } from '@academy-library/contracts';
import { resourceRepository } from '../../../shared/data/resources';

export interface UpdateResourceVariables {
  id: string;
  input: ResourceUpdateInput;
}

/** Same broad `['resources']` invalidation as `useCreateResourceMutation`
 * — an edit can change exactly the fields a cached list filtered/sorted
 * by (type, difficulty, tags, course, visibility), so the simplest
 * approach that can't leave a stale list or a stale detail entry behind
 * is to invalidate both at once, rather than patching one specific
 * cache entry and hoping nothing else needed to change. */
export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateResourceVariables) => resourceRepository.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}
