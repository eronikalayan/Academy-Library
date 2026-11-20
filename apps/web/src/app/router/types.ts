/**
 * App-defined shape of each route's `handle` — read back via
 * `useMatches()` (see widgets/app-header/Breadcrumb.tsx) to derive the
 * page title and breadcrumb trail from the route tree itself, instead of
 * maintaining a second path-to-title map that could drift out of sync.
 */
export interface RouteHandle {
  title?: string;
}
