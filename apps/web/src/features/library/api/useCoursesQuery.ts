import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';
import { fetchCourses } from './metadataApi';

/**
 * Backs the resource create/edit form's course picker with the real,
 * seed/admin-managed course list (Task 05C.3) — `GET /api/v1/courses`
 * is gated to `LECTURER`/`ADMIN` server-side; `enabled` mirrors that
 * here too, so a session that somehow reaches this hook without one of
 * those roles doesn't fire a request that can only 403. Not keyed by
 * user id — the list itself doesn't vary by *which* lecturer/admin is
 * asking, and `queryClient.clear()` on logout already prevents it
 * surviving into a different identity's session.
 */
export function useCoursesQuery() {
  const { data: user } = useCurrentUser();
  const canManageResources = user?.role === 'LECTURER' || user?.role === 'ADMIN';

  return useQuery({
    queryKey: ['courses'],
    queryFn: ({ signal }) => fetchCourses(signal),
    enabled: canManageResources,
    retry: shouldRetryTransientFailure,
  });
}
