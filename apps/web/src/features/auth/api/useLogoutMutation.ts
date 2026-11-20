import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from './authApi';
import { AUTH_ME_QUERY_KEY } from './useCurrentUser';

/**
 * `queryClient.clear()` first — not just resetting `['auth', 'me']` —
 * so nothing a *previous* user's session could have populated (any
 * resource/data queries added by a later task) survives into the next
 * person's view of this browser, per the task brief's "avoid displaying
 * previous-user data after account switching". `setQueryData` runs
 * immediately after, so the one query every mounted component actually
 * reads (`useCurrentUser`) has a correct, synchronous `null` rather than
 * sitting `undefined`/loading until the next mount re-fetches it.
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, null);
    },
  });
}
