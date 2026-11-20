import type { DashboardStats, PublicUser, ResourceListQuery } from '@academy-library/contracts';
import { countVisibleSavedResources } from '../bookmarks/bookmark.repository.js';
import { countVisibleCollections } from '../collections/collection.repository.js';
import { localPhysicalLibraryProvider } from '../physical-library/localPhysicalLibraryProvider.js';
import { countVisibleResources } from '../resources/resource.repository.js';
import { buildActorContext, listResources } from '../resources/resource.service.js';

/** A preview strip, not a page — see `DashboardStatsSchema`'s doc
 * comment in packages/contracts. */
const RECENT_RESOURCES_LIMIT = 5;

/**
 * Every number here is computed fresh, per request, from this specific
 * actor's own authorization-aware view — never a cached or system-wide
 * figure quietly relabeled as "yours." The five queries run concurrently
 * (`Promise.all`): none of them depends on another's result, and a
 * dashboard load is exactly the kind of read where that matters for
 * perceived speed. `recentResources` reuses `listResources` — the same
 * function the Library Explorer itself calls — rather than the lower-
 * level repository functions it's built from, the same "one source of
 * truth for what's visible" reasoning `learning.service.ts` applies.
 */
export async function getDashboardStats(actingUser: PublicUser): Promise<DashboardStats> {
  const actor = await buildActorContext(actingUser);
  const recentQuery: ResourceListQuery = {
    sort: 'newest',
    page: 1,
    pageSize: RECENT_RESOURCES_LIMIT,
  };

  const [
    totalAccessibleResources,
    savedResourcesCount,
    availableCollectionsCount,
    activeLoansCount,
    recent,
  ] = await Promise.all([
    countVisibleResources(actor),
    countVisibleSavedResources(actingUser.id, actor),
    countVisibleCollections(actor),
    localPhysicalLibraryProvider.countActiveLoansForUser(actingUser.id),
    listResources(recentQuery, actor),
  ]);

  return {
    totalAccessibleResources,
    savedResourcesCount,
    availableCollectionsCount,
    activeLoansCount,
    recentResources: recent.items,
  };
}
