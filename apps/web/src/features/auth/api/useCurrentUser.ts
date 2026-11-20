import { useQuery } from '@tanstack/react-query';
import { shouldRetryTransientFailure } from '../../../shared/api/retryPolicy';
import { fetchCurrentUser } from './authApi';

/** The one query key for "who is logged in" — mutations
 * (`useLoginMutation`/`useLogoutMutation`) write to this exact key
 * rather than invalidating-and-refetching, so a successful login/logout
 * updates every subscriber (header, sidebar, route guards) on the same
 * render pass, not after a second round trip. */
export const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

/**
 * The single source of truth for "who is the current user" — every
 * consumer (route guards, the header/profile menu, the sidebar) calls
 * this directly rather than reading from a separate context, so there
 * is exactly one cache entry for authentication state, not a second,
 * possibly-stale copy of it (see docs/architecture/authentication.md,
 * "Frontend session state").
 *
 * `retry: shouldRetryTransientFailure` (Task 05C.2 — previously a blanket
 * `retry: false`) — `fetchCurrentUser` already turns a `401` into a
 * successful `null` rather than a thrown error, so a `401` never reaches
 * this policy to begin with; what it actually governs is a *genuine*
 * network/server failure while checking the session. The original
 * `retry: false` was too blunt for that case: it meant one transient
 * blip (a dropped connection, a `502` from a restarting backend) would
 * immediately surface as `isError`, and `RequireAuth`
 * (app/auth/RequireAuth.tsx) treats that identically to "confirmed
 * logged out" — redirecting a user with a perfectly valid session
 * straight to `/login`. Retrying a couple of times first is what
 * actually distinguishes "the backend hiccuped" from "there is no
 * session," rather than conflating the two. See
 * `shared/api/retryPolicy.ts`.
 *
 * `refetchOnWindowFocus: true` — overrides this app's global default
 * (`refetchOnWindowFocus: false`, `app/queryClient.ts`) specifically for
 * this query: a session can expire server-side while a tab sits in the
 * background, and re-checking on refocus is how that gets noticed
 * without polling (see "Session lifecycle" in the architecture docs for
 * why there is no sliding/renewing expiry to react to instead).
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: shouldRetryTransientFailure,
    refetchOnWindowFocus: true,
  });
}
