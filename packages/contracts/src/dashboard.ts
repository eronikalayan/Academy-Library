import { z } from 'zod';
import { ResourceSummarySchema } from './resource.js';

/**
 * `GET /dashboard` (Task 07) — every count here is computed from the
 * *viewer's own* authorization-aware data: `totalAccessibleResources`
 * is never the catalogue's raw size, it's what `findVisibleResourcePage`
 * would return for this actor; `activeLoansCount` is never system-wide,
 * it's this user's own active loans. No field here is ever a fabricated
 * or placeholder number — a count genuinely unavailable (there is none
 * today) would be omitted or `0`, never invented. There is no
 * `quickActions` field: which quick actions make sense (e.g. "Create
 * resource" for a LECTURER/ADMIN, not a STUDENT) is a pure role-based
 * rendering decision the frontend already has everything it needs for
 * via `useCurrentUser()`, the same way the sidebar nav's own role
 * filtering works — not something worth a server round trip to decide.
 */
export const DashboardStatsSchema = z
  .object({
    totalAccessibleResources: z.number().int().nonnegative(),
    savedResourcesCount: z.number().int().nonnegative(),
    availableCollectionsCount: z.number().int().nonnegative(),
    activeLoansCount: z.number().int().nonnegative(),
    /** Newest-first, small and bounded (see `dashboard.service.ts`) —
     * not a paginated listing, this is a preview strip, not a page. */
    recentResources: z.array(ResourceSummarySchema),
  })
  .strict();
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
