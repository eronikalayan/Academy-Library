import { Outlet } from 'react-router-dom';

/**
 * A thin extension of `AppLayout` for the `/admin/*` branch. No banner
 * here anymore — through Task 05C.1, this route is only ever reached
 * once `RequireRole` (`app/auth/RequireRole.tsx`) has confirmed a real
 * `ADMIN` session, which itself only ever reflects what
 * `apps/api/src/modules/auth/auth.middleware.ts`'s `requireRole`
 * independently enforces server-side. There is no longer anything
 * honest to disclaim here the way there was before real authentication
 * existed (see docs/architecture/decisions.md's Task 03/05A history).
 */
export function AdminLayout() {
  return <Outlet />;
}
