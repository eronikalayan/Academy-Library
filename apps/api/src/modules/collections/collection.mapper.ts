import {
  CollectionDetailSchema,
  CollectionSummarySchema,
  type CollectionDetail,
  type CollectionSummary,
  type PublicUser,
} from '@academy-library/contracts';
import { toResourceSummary } from '../resources/resource.mapper.js';
import { collectionCapabilities } from './collection.policy.js';
import type { CollectionWithRelations } from './collection.types.js';

/**
 * The only place a hydrated `Collection` row becomes the DTO a client
 * is allowed to see — mirrors `resource.mapper.ts`'s `toResourceDetail`
 * exactly, including parsing the constructed object back through the
 * contract schema as a runtime assertion. `ownerId` never leaves this
 * function's input, same structural guarantee as the Resource domain.
 *
 * Callers MUST pass a `collection` whose `items` have already been
 * filtered to what this specific viewer may see (see
 * `collection.service.ts`'s `withVisibleItemsOnly`) — this function has
 * no visibility logic of its own and trusts its input completely,
 * exactly like `toResourceDetail` trusts that `isResourceVisibleTo` was
 * already checked by its caller.
 */
export function toCollectionDetail(
  collection: CollectionWithRelations,
  actor: Pick<PublicUser, 'id' | 'role'> | null,
): CollectionDetail {
  return CollectionDetailSchema.parse({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    coverImageUrl: collection.coverImageUrl,
    visibility: collection.visibility,
    restrictedToGroupIds: collection.groups.map((entry) => entry.groupId),
    capabilities: collectionCapabilities(actor, collection),
    resources: collection.items.map((item) => ({
      resource: toResourceSummary(item.resource),
      position: item.position,
    })),
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  });
}

/** `resourceCount` reflects `collection.items.length` as given — the
 * same already-filtered array `toCollectionDetail` expects, so a
 * restricted item invisible to this viewer never inflates the count on
 * a list card any more than it would appear in the detail view. */
export function toCollectionSummary(collection: CollectionWithRelations): CollectionSummary {
  return CollectionSummarySchema.parse({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    coverImageUrl: collection.coverImageUrl,
    visibility: collection.visibility,
    resourceCount: collection.items.length,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  });
}
