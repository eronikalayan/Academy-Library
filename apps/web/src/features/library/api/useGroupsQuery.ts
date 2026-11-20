import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';
import { fetchGroups } from './metadataApi';

/** Same reasoning as `useCoursesQuery` — backs the resource create/edit
 * form's restricted-group picker with the real group list. */
export function useGroupsQuery() {
  const { data: user } = useCurrentUser();
  const canManageResources = user?.role === 'LECTURER' || user?.role === 'ADMIN';

  return useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => fetchGroups(signal),
    enabled: canManageResources,
    retry: shouldRetryTransientFailure,
  });
}
