import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { buildVisibilityCondition, hydrateResources } from '../resources/resource.repository.js';
import type { ActorContext, ResourceWithRelations } from '../resources/resource.types.js';

export interface BookmarkEntry {
  resource: ResourceWithRelations;
  createdAt: Date;
}

export interface SavedResourcePage {
  entries: BookmarkEntry[];
  totalItems: number;
}

export interface SavedResourceSearchParams {
  page: number;
  pageSize: number;
}

/**
 * Authorized, paginated page of one user's saved resources, filtered at
 * the database level by the exact same visibility rule every other read
 * path uses (`buildVisibilityCondition`, reused unchanged from
 * `resource.repository.ts` — both queries join against a table aliased
 * `r` for `resources`, which is the only thing that function assumes).
 *
 * Replaces the earlier "fetch every row this user ever saved, then
 * filter/paginate in application code" approach (Task 06), which was
 * only ever correct up to a user's entire saved-resource history fitting
 * comfortably in memory — a user with hundreds or thousands of bookmarks
 * would have paid an ever-growing per-request cost for a list endpoint
 * that is supposed to be O(page size), not O(total saved). Two queries
 * (count, then a page of ids), not one with `COUNT(*) OVER()` — same
 * reasoning as `findVisibleResourcePage`: a `COUNT(*) OVER()` value is
 * only readable off a *returned* row, and an out-of-range page
 * legitimately returns none.
 */
export async function findVisibleSavedResourcePage(
  userId: string,
  actor: ActorContext | null,
  params: SavedResourceSearchParams,
): Promise<SavedResourcePage> {
  const whereClause = Prisma.sql`sr."userId" = ${userId} AND ${buildVisibilityCondition(actor)}`;

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM saved_resources sr
    JOIN resources r ON r.id = sr."resourceId"
    WHERE ${whereClause}
  `);
  const totalItems = Number(countRows[0]?.count ?? 0n);
  if (totalItems === 0) {
    return { entries: [], totalItems: 0 };
  }

  const offset = (params.page - 1) * params.pageSize;
  const rows = await prisma.$queryRaw<{ resourceId: string; createdAt: Date }[]>(Prisma.sql`
    SELECT sr."resourceId" AS "resourceId", sr."createdAt" AS "createdAt"
    FROM saved_resources sr
    JOIN resources r ON r.id = sr."resourceId"
    WHERE ${whereClause}
    ORDER BY sr."createdAt" DESC, sr."resourceId" DESC
    LIMIT ${params.pageSize} OFFSET ${offset}
  `);

  // `(userId, resourceId)` is a DB-level unique constraint — each
  // resourceId appears in `rows` at most once, so this map is safe.
  const createdAtByResourceId = new Map(rows.map((row) => [row.resourceId, row.createdAt]));
  const resources = await hydrateResources(rows.map((row) => row.resourceId));
  const entries = resources.map((resource) => {
    const createdAt = createdAtByResourceId.get(resource.id);
    // Every id in `resources` came from `rows` immediately above —
    // its `createdAt` must still be in the map.
    if (!createdAt) throw new Error(`Saved resource ${resource.id} missing its createdAt`);
    return { resource, createdAt };
  });

  return { entries, totalItems };
}

/** Standalone count — same reasoning as `resource.repository.ts`'s
 * `countVisibleResources`. Used by `dashboard.service.ts`'s
 * `savedResourcesCount` (Task 07). */
export async function countVisibleSavedResources(
  userId: string,
  actor: ActorContext | null,
): Promise<number> {
  const whereClause = Prisma.sql`sr."userId" = ${userId} AND ${buildVisibilityCondition(actor)}`;
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM saved_resources sr
    JOIN resources r ON r.id = sr."resourceId"
    WHERE ${whereClause}
  `);
  return Number(rows[0]?.count ?? 0n);
}

/** `upsert` against the `(userId, resourceId)` unique constraint — the
 * entire save/unsave idempotency story: saving an already-saved
 * resource is a silent no-op, never a duplicate row or a `409`. */
export async function createBookmark(userId: string, resourceId: string): Promise<void> {
  await prisma.savedResource.upsert({
    where: { userId_resourceId: { userId, resourceId } },
    create: { userId, resourceId },
    update: {},
  });
}

/** `deleteMany` matching zero rows is not an error — removing a
 * bookmark that isn't (or no longer is) present is a no-op, same
 * "ensure absent" semantics as `removeCollectionResource`. */
export async function deleteBookmark(userId: string, resourceId: string): Promise<void> {
  await prisma.savedResource.deleteMany({ where: { userId, resourceId } });
}

/**
 * A single lookup against the `(userId, resourceId)` unique index —
 * O(1) regardless of how many resources this user has ever saved, and
 * the fix for `useIsResourceSaved` previously only being able to answer
 * this question for a caller's first 60 bookmarks (Task 06's
 * `SAVED_RESOURCES_PAGE_SIZE` cap). No visibility check: the answer
 * depends only on this user's own saved rows, and discloses nothing
 * about a resource's existence either way — "not saved" and "doesn't
 * exist" produce the identical `false`, same as any other saved/unsaved
 * boolean for a resource this user already knows the id of (they are
 * asking this from a page that already loaded that resource).
 */
export async function isResourceSavedByUser(userId: string, resourceId: string): Promise<boolean> {
  const existing = await prisma.savedResource.findUnique({
    where: { userId_resourceId: { userId, resourceId } },
    select: { id: true },
  });
  return existing !== null;
}
