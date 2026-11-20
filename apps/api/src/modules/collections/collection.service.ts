import type {
  CollectionCreateInput,
  CollectionDetail,
  CollectionListQuery,
  CollectionResourceOrderInput,
  CollectionSummaryListResponse,
  CollectionUpdateInput,
  PublicUser,
} from '@academy-library/contracts';
import { AppError } from '../../errors/AppError.js';
import { authorize } from '../auth/policy.js';
import { isResourceVisibleTo } from '../resources/resource.policy.js';
import { findGroupsByIds, findResourceById } from '../resources/resource.repository.js';
import { buildActorContext } from '../resources/resource.service.js';
import { toCollectionDetail, toCollectionSummary } from './collection.mapper.js';
import {
  canCreateCollection,
  canModifyCollection,
  isCollectionVisibleTo,
} from './collection.policy.js';
import {
  addCollectionResource,
  createCollection as createCollectionRow,
  deleteCollection as deleteCollectionRow,
  findCollectionById,
  findVisibleCollectionPage,
  hydrateCollections,
  removeCollectionResource,
  reorderCollectionResources,
  updateCollection as updateCollectionRow,
  type CreateCollectionData,
  type UpdateCollectionData,
} from './collection.repository.js';
import type {
  ActorContext,
  CollectionItemWithResource,
  CollectionWithRelations,
} from './collection.types.js';

function uniqueNormalized(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

/** Resolves caller-supplied group ids against real rows, same pattern
 * (and same error shape) as `resource.service.ts`'s `resolveGroupIds` —
 * a client cannot silently restrict a collection to a group that was
 * never created. */
async function resolveGroupIds(groupIds: readonly string[]): Promise<string[]> {
  const ids = uniqueNormalized(groupIds);
  if (ids.length === 0) return [];
  const found = await findGroupsByIds(ids);
  const foundIds = new Set(found.map((group) => group.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw AppError.badRequest('One or more restrictedToGroupIds do not exist', {
      invalidGroupIds: missing,
    });
  }
  return ids;
}

/**
 * Filters a collection's items down to only the ones *this specific
 * viewer* can independently see — the critical rule the task brief
 * calls out: a collection's own visibility (already checked by
 * `isCollectionVisibleTo` before this ever runs) never implies
 * anything about a member resource's visibility. Reuses the exact same
 * `isResourceVisibleTo` policy a standalone `GET /resources/:id` call
 * goes through, so a resource hidden from this viewer there is hidden
 * from them here, for the identical reason — not a second, parallel
 * authorization rule that could drift from the first.
 *
 * Every read path below (`listCollections`, `getCollectionById`, and
 * every mutation that returns the collection's new state) passes its
 * result through this before it ever reaches a mapper — there is no
 * code path that hands an unfiltered `items` array to
 * `toCollectionDetail`/`toCollectionSummary`.
 */
function withVisibleItemsOnly(
  collection: CollectionWithRelations,
  actor: ActorContext | null,
): CollectionWithRelations {
  const visibleItems: CollectionItemWithResource[] = collection.items.filter((item) =>
    isResourceVisibleTo(item.resource, actor),
  );
  return { ...collection, items: visibleItems };
}

export async function listCollections(
  query: CollectionListQuery,
  actor: ActorContext | null,
): Promise<CollectionSummaryListResponse> {
  const { ids, totalItems } = await findVisibleCollectionPage(
    {
      search: query.search,
      visibility: query.visibility,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    },
    actor,
  );

  const records = await hydrateCollections(ids);
  // Same "echo the requested page, never clamp" contract as
  // `resource.service.ts`'s `listResources` — see that function's doc
  // comment.
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: records.map((record) => toCollectionSummary(withVisibleItemsOnly(record, actor))),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
  };
}

export async function getCollectionById(
  id: string,
  actor: ActorContext | null,
): Promise<CollectionDetail> {
  const record = await findCollectionById(id);
  if (!record || !isCollectionVisibleTo(record, actor)) {
    throw AppError.notFound('Collection not found');
  }
  const filtered = withVisibleItemsOnly(record, actor);
  return toCollectionDetail(filtered, actor ? { id: actor.userId, role: actor.role } : null);
}

export async function createCollection(
  input: CollectionCreateInput,
  actor: PublicUser,
): Promise<CollectionDetail> {
  authorize(canCreateCollection, actor, undefined);
  const groupIds = await resolveGroupIds(input.restrictedToGroupIds);

  const data: CreateCollectionData = {
    title: input.title,
    description: input.description,
    coverImageUrl: input.coverImageUrl ?? null,
    visibility: input.visibility,
    ownerId: actor.id,
    groupIds,
  };
  const created = await createCollectionRow(data);
  // A freshly created collection always has zero items (they're added
  // via a separate endpoint below) — nothing to filter yet.
  return toCollectionDetail(created, actor);
}

export async function updateCollection(
  id: string,
  input: CollectionUpdateInput,
  actor: PublicUser,
): Promise<CollectionDetail> {
  const actorContext = await buildActorContext(actor);
  const existing = await findCollectionById(id);
  if (!existing || !isCollectionVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Collection not found');
  }
  authorize(canModifyCollection, actor, existing);

  const groupIds =
    input.restrictedToGroupIds !== undefined
      ? await resolveGroupIds(input.restrictedToGroupIds)
      : undefined;

  // Same "check the merged state" reasoning as
  // `resource.service.ts`'s `validateMergedInvariants`:
  // `CollectionUpdateInputSchema` is flat and cannot see `existing`, so
  // it alone can't catch a payload that only clears
  // `restrictedToGroupIds` on a collection that is *already*
  // `RESTRICTED` while omitting `visibility` entirely.
  const effectiveVisibility = input.visibility ?? existing.visibility;
  const effectiveGroupIds = groupIds ?? existing.groups.map((entry) => entry.groupId);
  if (effectiveVisibility === 'RESTRICTED' && effectiveGroupIds.length === 0) {
    throw AppError.badRequest(
      'restrictedToGroupIds must list at least one group when visibility is RESTRICTED',
    );
  }

  const data: UpdateCollectionData = {
    title: input.title,
    description: input.description,
    coverImageUrl: input.coverImageUrl,
    visibility: input.visibility,
    groupIds,
  };
  const updated = await updateCollectionRow(id, data);
  const filtered = withVisibleItemsOnly(updated, actorContext);
  return toCollectionDetail(filtered, actor);
}

export async function deleteCollection(id: string, actor: PublicUser): Promise<void> {
  const actorContext = await buildActorContext(actor);
  const existing = await findCollectionById(id);
  if (!existing || !isCollectionVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Collection not found');
  }
  authorize(canModifyCollection, actor, existing);
  await deleteCollectionRow(id);
}

/**
 * Adding a resource to a collection requires the actor to be able to
 * see that resource *independently* — otherwise this endpoint would be
 * a way to confirm a restricted resource's existence (by seeing whether
 * the add succeeds) without ever having access to it. The resource
 * must be visible to the same actor adding it, checked via the exact
 * `isResourceVisibleTo` policy a direct `GET /resources/:id` would use.
 *
 * Idempotent, per the task brief's documented-policy option for
 * duplicates: adding a resource already in the collection is a no-op
 * that returns the collection's current state unchanged, not an error
 * — see `collection.repository.ts`'s `addCollectionResource` for where
 * that's decided, under the same lock that makes the position
 * assignment deterministic for a genuinely new item.
 */
export async function addResourceToCollection(
  collectionId: string,
  resourceId: string,
  actor: PublicUser,
): Promise<CollectionDetail> {
  const actorContext = await buildActorContext(actor);
  const existing = await findCollectionById(collectionId);
  if (!existing || !isCollectionVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Collection not found');
  }
  authorize(canModifyCollection, actor, existing);

  const resource = await findResourceById(resourceId);
  if (!resource || !isResourceVisibleTo(resource, actorContext)) {
    throw AppError.badRequest('Resource does not exist or is not accessible', {
      invalidResourceIds: [resourceId],
    });
  }

  const { collection } = await addCollectionResource(collectionId, resourceId);
  const filtered = withVisibleItemsOnly(collection, actorContext);
  return toCollectionDetail(filtered, actor);
}

/** Idempotent: removing a resource that is not (or no longer) a member
 * is a no-op, not a 404 — the caller's intent ("this resource should
 * not be in this collection") is already satisfied. Returns the
 * collection's new state, same as `addResourceToCollection`, so the
 * frontend never needs a second round-trip just to refresh what it's
 * already displaying. */
export async function removeResourceFromCollection(
  collectionId: string,
  resourceId: string,
  actor: PublicUser,
): Promise<CollectionDetail> {
  const actorContext = await buildActorContext(actor);
  const existing = await findCollectionById(collectionId);
  if (!existing || !isCollectionVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Collection not found');
  }
  authorize(canModifyCollection, actor, existing);
  const collection = await removeCollectionResource(collectionId, resourceId);
  const filtered = withVisibleItemsOnly(collection, actorContext);
  return toCollectionDetail(filtered, actor);
}

/**
 * The reorder input must match the collection's *actual* current
 * membership exactly (every id, no more, no fewer, no duplicates) —
 * this endpoint only ever changes order, never membership, so any
 * mismatch is rejected with a `400` naming the real current membership
 * rather than silently adding, dropping, or ignoring items. See
 * `collection.repository.ts`'s `reorderCollectionResources` for why
 * that comparison happens inside the same locked transaction as the
 * write, not as a separate check beforehand.
 */
export async function reorderCollectionResourceItems(
  collectionId: string,
  input: CollectionResourceOrderInput,
  actor: PublicUser,
): Promise<CollectionDetail> {
  const actorContext = await buildActorContext(actor);
  const existing = await findCollectionById(collectionId);
  if (!existing || !isCollectionVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Collection not found');
  }
  authorize(canModifyCollection, actor, existing);

  const result = await reorderCollectionResources(collectionId, input.resourceIds);
  if (result.mismatch) {
    throw AppError.badRequest(
      "resourceIds must exactly match the collection's current resource membership " +
        '(no additions, removals, or duplicates) — use the add/remove endpoints to change membership',
      { currentResourceIds: result.currentResourceIds },
    );
  }

  const filtered = withVisibleItemsOnly(result.collection, actorContext);
  return toCollectionDetail(filtered, actor);
}
