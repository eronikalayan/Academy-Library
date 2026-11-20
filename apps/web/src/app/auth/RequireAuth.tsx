import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { Button } from '../../shared/ui/Button';
import { FullPageMessage, FullPageSpinner } from './FullPageState';

/**
 * Gates the entire authenticated product shell (mounted as the parent
 * `element` of the `AppLayout` route branch — see `router/routes.tsx`).
 *
 * - While the session check is in flight, renders a full-page spinner,
 *   never `<Outlet/>` — this is what prevents a flash of protected
 *   content before `useCurrentUser()` has actually resolved.
 * - `isError` (the check itself failed, after `useCurrentUser`'s own
 *   `shouldRetryTransientFailure` retries were exhausted — see that
 *   hook) renders a recoverable "couldn't verify your session" state
 *   with a Retry button, *not* a redirect (Task 05D). Redirecting to
 *   `/login` here was the original behavior and is still the right
 *   instinct for `!user` (a confirmed `401` — see below), but doing the
 *   same for a genuine network/`5xx` failure is actively misleading: it
 *   tells a still-logged-in user they've been logged out, and sends
 *   them toward re-entering credentials that were never the problem.
 *   Still fails closed exactly as before — `<Outlet/>` never renders
 *   while `isError` is true — this only changes *which* non-protected
 *   UI is shown, not whether the security boundary holds (see
 *   docs/architecture/decisions.md, "`RequireAuth` fails closed on a
 *   query error, not just on `null`").
 * - `!user` (confirmed anonymous — the server said `401`, with no
 *   error) redirects to `/login`, preserving the destination via
 *   `?from=` — consumed by `LoginPage` after a successful sign-in; see
 *   `safeRedirect.ts` for why that value is validated again on the way
 *   back out, not trusted just because this component is the one that
 *   set it. `replace` on the `<Navigate>` so the protected URL that
 *   triggered the redirect never ends up in browser history as its own
 *   entry (hitting "back" from `/login` would otherwise bounce right
 *   back to the page that just redirected away from itself).
 */
export function RequireAuth() {
  const { data: user, isLoading, isError, refetch, isRefetching } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isError) {
    return (
      <FullPageMessage
        title="Couldn't verify your session"
        message="We weren't able to check whether you're signed in. This is usually temporary — check your connection and try again."
        action={
          <Button onClick={() => void refetch()} isLoading={isRefetching}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!user) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }

  return <Outlet />;
}
