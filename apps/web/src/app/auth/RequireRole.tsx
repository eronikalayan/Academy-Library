import { Outlet } from 'react-router-dom';
import type { Role } from '@academy-library/contracts';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { FullPageMessage, FullPageSpinner } from './FullPageState';

export interface RequireRoleProps {
  roles: readonly Role[];
}

/**
 * Mounted *inside* `RequireAuth`'s subtree (as the `admin` route's
 * `element` — see `router/routes.tsx`), so a `user` always exists by
 * the time this renders; it only narrows further, by role.
 *
 * Renders an honest 403 page rather than silently redirecting — a
 * signed-in `STUDENT`/`LECTURER` who navigates to `/admin` gets a clear
 * "you don't have access" message, not a confusing bounce to a
 * different page that looks like a dead link. This is a UX nicety,
 * never the actual security boundary: the real `/admin*` pages assume
 * nothing beyond "a request has whatever role the backend session
 * says" — exactly as authoritative, and no more, than
 * `apps/api/src/modules/auth/auth.middleware.ts`'s `requireRole` is on
 * the server. If this component were deleted entirely, the backend
 * would still reject every admin-only API call from a non-admin
 * session; this only controls what the frontend *renders*.
 */
export function RequireRole({ roles }: RequireRoleProps) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!user || !roles.includes(user.role)) {
    return (
      <FullPageMessage
        title="You don't have access to this page"
        message="This section is restricted to administrators. If you believe this is a mistake, contact your administrator."
      />
    );
  }

  return <Outlet />;
}
