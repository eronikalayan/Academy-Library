import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from './authApi';
import { AUTH_ME_QUERY_KEY } from './useCurrentUser';

/**
 * On success, writes the returned user directly into the `['auth',
 * 'me']` cache entry via `setQueryData` rather than invalidating and
 * refetching — the login response already *is* the same `AuthResponse`
 * shape `/me` returns, so a second round trip would just confirm what
 * this response already said. Every component reading `useCurrentUser`
 * (route guards included) re-renders with the new user on this same
 * tick.
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, data.user);
    },
  });
}
