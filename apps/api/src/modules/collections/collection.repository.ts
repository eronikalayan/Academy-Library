import { Prisma } from '@prisma/client';
import type { CollectionSort, CollectionVisibility } from '@academy-library/contracts';
import { prisma } from '../../lib/prisma.js';
import { RESOURCE_INCLUDE } from '../resources/resource.repository.js';
import type { ActorContext, CollectionWithRelations } from './collection.types.js';

// See resource.repository.ts's identical `RESOURCE_INCLUDE` comment for
// why this is declared with `satisfies` rather than typed as
// `Prisma.CollectionInclude` directly. Items are always read in display
// order — nothing in this module re-sorts them client-side.
const COLLECTION_INCLUDE = {
  items: {
    orderBy: { position: 'asc' },
    include: { resource: { include: RESOURCE_INCLUDE } },
  },
  groups: { include: { group: true } },
} satisfies Prisma.CollectionInclude;

export interface CollectionSearchParams {
  search?: string;
  visibility?: CollectionVisibility;
  sort: CollectionSort;
  page: number;
  pageSize: number;
}

/**
 * The same "may this actor see this collection" rule as
 * `collection.policy.ts`'s `isCollectionVisibleTo`, expressed as a SQL
 * fragment — see that function's doc comment for why both exist, the
 * maintenance cost of keeping them in sync, and why `actor === null`
 * returns `FALSE` unconditionally (Collections require authentication
 * even for `PUBLIC`, unlike Resources). `c` is the fixed alias every
 * caller below uses for the `collections` table.
 */
function buildVisibilityCondition(actor: ActorContext | null): Prisma.Sql {
  if (actor?.role === 'ADMIN') return Prisma.sql`TRUE`;
  if (!actor) return Prisma.sql`FALSE`;
  const groupClause =
    actor.groupIds.length > 0
      ? Prisma.sql` OR (c.visibility = 'RESTRICTED' AND EXISTS (
          SELECT 1 FROM collection_groups cg
          WHERE cg."collectionId" = c.id AND cg."groupId" IN (${Prisma.join(actor.groupIds)})
        ))`
      : Prisma.empty;
  return Prisma.sql`(c.visibility = 'PUBLIC' OR c."ownerId" = ${actor.userId}${groupClause})`;
}

/** Plain `ILIKE` over title/description — Collections have no
 * full-text-search infrastructure of their own (no generated
 * `searchVector`, no GIN index) and the task brief does not ask for
 * relevance ranking here, only "filtering, sorting, and bounded
 * pagination"; adding that machinery for a second domain without a
 * demonstrated need would be exactly the "unrelated infrastructure"
 * the brief says not to introduce. */
function buildFilterConditions(params: CollectionSearchParams): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (params.visibility) {
    conditions.push(Prisma.sql`c.visibility = ${params.visibility}::"CollectionVisibility"`);
  }
  if (params.search) {
    const pattern = `%${params.search}%`;
    conditions.push(Prisma.sql`(c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})`);
  }
  return conditions;
}

/** Every branch ends in an explicit tie-breaker (`c.id`) — same reason
 * as `resource.repository.ts`'s `buildOrderClause`: `createdAt`/`title`
 * are not unique, so without one, equal-ranked rows could reorder
 * between identical requests and silently corrupt pagination. */
function buildOrderClause(sort: CollectionSort): Prisma.Sql {
  if (sort === 'title_asc') {
    return Prisma.sql`ORDER BY c.title ASC, c.id ASC`;
  }
  return Prisma.sql`ORDER BY c."createdAt" DESC, c.id DESC`;
}

interface CollectionPage {
  ids: string[];
  totalItems: number;
}

/**
 * Returns the authorized, filtered, paginated page of collection ids
 * plus the total count *after* authorization — mirrors
 * `findVisibleResourcePage`'s two-query (count, then ids) shape and
 * rationale exactly: a restricted collection the caller cannot see must
 * never inflate `totalItems`/`totalPages`, and `COUNT(*) OVER()` cannot
 * return a count on an out-of-range page.
 */
export async function findVisibleCollectionPage(
  params: CollectionSearchParams,
  actor: ActorContext | null,
): Promise<CollectionPage> {
  const conditions = [buildVisibilityCondition(actor), ...buildFilterConditions(params)];
  const whereClause = Prisma.join(conditions, ' AND ');

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM collections c WHERE ${whereClause}`,
  );
  const totalItems = Number(countRows[0]?.count ?? 0n);
  if (totalItems === 0) {
    return { ids: [], totalItems: 0 };
  }

  const orderClause = buildOrderClause(params.sort);
  const offset = (params.page - 1) * params.pageSize;
  const idRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id, c."createdAt", c.title
    FROM collections c
    WHERE ${whereClause}
    ${orderClause}
    LIMIT ${params.pageSize} OFFSET ${offset}
  `);

  return { ids: idRows.map((row) => row.id), totalItems };
}

/** Hydrates ids into full rows in exactly one query, then re-orders in
 * memory to match `ids` — identical no-N+1 reasoning as
 * `hydrateResources`. */
export async function hydrateCollections(ids: string[]): Promise<CollectionWithRelations[]> {
  if (ids.length === 0) return [];
  const records = await prisma.collection.findMany({
    where: { id: { in: ids } },
    include: COLLECTION_INCLUDE,
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  const ordered: CollectionWithRelations[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (record) ordered.push(record);
  }
  return ordered;
}

export function findCollectionById(id: string): Promise<CollectionWithRelations | null> {
  return prisma.collection.findUnique({ where: { id }, include: COLLECTION_INCLUDE });
}

/** Standalone count — same reasoning as `resource.repository.ts`'s
 * `countVisibleResources`. Used by `dashboard.service.ts`'s
 * `availableCollectionsCount` (Task 07). */
export async function countVisibleCollections(actor: ActorContext | null): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM collections c WHERE ${buildVisibilityCondition(actor)}`,
  );
  return Number(rows[0]?.count ?? 0n);
}

export interface CreateCollectionData {
  title: string;
  description: string;
  coverImageUrl?: string | null;
  visibility: CollectionVisibility;
  ownerId: string;
  groupIds: string[];
}

export function createCollection(data: CreateCollectionData): Promise<CollectionWithRelations> {
  return prisma.collection.create({
    data: {
      title: data.title,
      description: data.description,
      coverImageUrl: data.coverImageUrl ?? null,
      visibility: data.visibility,
      ownerId: data.ownerId,
      groups: { create: data.groupIds.map((groupId) => ({ groupId })) },
    },
    include: COLLECTION_INCLUDE,
  });
}

export interface UpdateCollectionData {
  title?: string;
  description?: string;
  coverImageUrl?: string | null;
  visibility?: CollectionVisibility;
  /** `undefined` = leave group associations unchanged (PATCH
   * semantics); an array (including `[]`) = replace them entirely —
   * same convention as `resource.repository.ts`'s `UpdateResourceData`. */
  groupIds?: string[];
}

export async function updateCollection(
  id: string,
  data: UpdateCollectionData,
): Promise<CollectionWithRelations> {
  await prisma.$transaction(async (tx) => {
    await tx.collection.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        visibility: data.visibility,
      },
    });

    if (data.groupIds !== undefined) {
      await tx.collectionGroup.deleteMany({ where: { collectionId: id } });
      if (data.groupIds.length > 0) {
        await tx.collectionGroup.createMany({
          data: data.groupIds.map((groupId) => ({ collectionId: id, groupId })),
        });
      }
    }
  });

  const updated = await findCollectionById(id);
  if (!updated) throw new Error(`Collection ${id} disappeared immediately after update`);
  return updated;
}

export async function deleteCollection(id: string): Promise<void> {
  await prisma.collection.delete({ where: { id } });
}

/**
 * Locks the collection row for the rest of the transaction
 * (`SELECT ... FOR UPDATE`) — the one thing that makes concurrent
 * add/remove/reorder calls against the *same* collection serialize
 * instead of interleaving, rather than each reading a membership/
 * position snapshot that the other has since invalidated. Every
 * mutation below that touches `collection_resources` takes this lock
 * first, before reading or writing anything else about that
 * collection's membership or order. See
 * docs/domain/collections.md ("Concurrency strategy") for why a row
 * lock, not optimistic versioning, was chosen — there is exactly one
 * writer-contention scenario here (two requests against the same
 * collection), and Postgres already has a primitive for that.
 */
async function lockCollectionForUpdate(
  tx: Prisma.TransactionClient,
  collectionId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM collections WHERE id = ${collectionId} FOR UPDATE`;
}

export interface AddResourceResult {
  collection: CollectionWithRelations;
  /** `true` if the resource was already a member — see
   * `collection.service.ts` for why this makes the add idempotent
   * rather than an error. */
  alreadyPresent: boolean;
}

/** Appending a resource is "deterministic" (per the task brief) in the
 * sense that matters: the new item's position is always
 * `currentMax + 1`, computed and written inside the same locked
 * transaction, so two concurrent adds to the same collection can never
 * compute the same "next" position and collide. */
export async function addCollectionResource(
  collectionId: string,
  resourceId: string,
): Promise<AddResourceResult> {
  const alreadyPresent = await prisma.$transaction(async (tx) => {
    await lockCollectionForUpdate(tx, collectionId);

    const existing = await tx.collectionResource.findUnique({
      where: { collectionId_resourceId: { collectionId, resourceId } },
    });
    if (existing) return true;

    const maxPosition = await tx.collectionResource.aggregate({
      where: { collectionId },
      _max: { position: true },
    });
    const nextPosition = (maxPosition._max.position ?? -1) + 1;
    await tx.collectionResource.create({
      data: { collectionId, resourceId, position: nextPosition },
    });
    return false;
  });

  const collection = await findCollectionById(collectionId);
  if (!collection) throw new Error(`Collection ${collectionId} disappeared immediately after add`);
  return { collection, alreadyPresent };
}

/** Idempotent by construction — `deleteMany` matching zero rows is not
 * an error, same "remove means ensure absent" semantics as the add path
 * above means "ensure present." */
export async function removeCollectionResource(
  collectionId: string,
  resourceId: string,
): Promise<CollectionWithRelations> {
  await prisma.$transaction(async (tx) => {
    await lockCollectionForUpdate(tx, collectionId);
    await tx.collectionResource.deleteMany({ where: { collectionId, resourceId } });
  });

  const collection = await findCollectionById(collectionId);
  if (!collection) {
    throw new Error(`Collection ${collectionId} disappeared immediately after remove`);
  }
  return collection;
}

export interface ReorderSuccess {
  mismatch: false;
  collection: CollectionWithRelations;
}
export interface ReorderMismatch {
  mismatch: true;
  currentResourceIds: string[];
}

/**
 * Rewrites every item's `position` to match `orderedResourceIds`
 * exactly — but only after confirming, *inside the same lock*, that
 * `orderedResourceIds` is the same set as the collection's current
 * membership. Checking this before opening the transaction (or in a
 * separate query before acquiring the lock) would leave a real
 * race: a concurrent add/remove could change membership between the
 * check and the write. Doing both under one `SELECT ... FOR UPDATE`
 * closes that gap — no other add/remove/reorder on this collection can
 * run between the membership check and the position rewrite.
 *
 * A length-and-set comparison (not just a set comparison) catches a
 * client-supplied list with a repeated id, which would otherwise pass
 * a naive set-equality check while still being invalid input.
 */
export async function reorderCollectionResources(
  collectionId: string,
  orderedResourceIds: string[],
): Promise<ReorderSuccess | ReorderMismatch> {
  const result = await prisma.$transaction(async (tx) => {
    await lockCollectionForUpdate(tx, collectionId);

    const current = await tx.collectionResource.findMany({
      where: { collectionId },
      select: { resourceId: true },
    });
    const currentIds = current.map((row) => row.resourceId);
    const currentSet = new Set(currentIds);
    const requestedSet = new Set(orderedResourceIds);
    const setsMatch =
      orderedResourceIds.length === currentIds.length &&
      currentSet.size === requestedSet.size &&
      [...currentSet].every((id) => requestedSet.has(id));

    if (!setsMatch) {
      return { mismatch: true as const, currentResourceIds: currentIds };
    }

    for (const [index, resourceId] of orderedResourceIds.entries()) {
      await tx.collectionResource.update({
        where: { collectionId_resourceId: { collectionId, resourceId } },
        data: { position: index },
      });
    }
    return { mismatch: false as const };
  });

  if (result.mismatch) {
    return result;
  }

  const collection = await findCollectionById(collectionId);
  if (!collection) {
    throw new Error(`Collection ${collectionId} disappeared immediately after reorder`);
  }
  return { mismatch: false, collection };
}
