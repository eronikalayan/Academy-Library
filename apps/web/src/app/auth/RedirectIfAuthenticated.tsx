import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { resolveSafeRedirect } from './safeRedirect';
import { FullPageSpinner } from './FullPageState';

const DEFAULT_AUTHENTICATED_PATH = '/dashboard';
const AUTH_PATHS = ['/login', '/register'];

/**
 * Wraps `/login` and `/register` (see `router/routes.tsx`) so an
 * already-authenticated visitor is sent on to the app instead of seeing
 * a sign-in form for an account they're already signed into. Honors the
 * same `?from=` an earlier `RequireAuth` redirect may have attached —
 * e.g. opening `/library/abc` while logged out, then logging in,
 * lands back on `/library/abc` — but re-validates it with the same
 * `resolveSafeRedirect` guard `LoginPage` uses, and additionally
 * excludes the auth pages themselves from `from`, which is what stops a
 * crafted `/login?from=/login` from bouncing an authenticated visitor
 * straight back to `/login` forever.
 */
export function RedirectIfAuthenticated() {
  const { data: user, isLoading } = useCurrentUser();
  const [searchParams] = useSearchParams();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (user) {
    const destination = resolveSafeRedirect(searchParams.get('from'), {
      fallback: DEFAULT_AUTHENTICATED_PATH,
      excludePaths: AUTH_PATHS,
    });
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
