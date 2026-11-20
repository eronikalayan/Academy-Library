import type { Collection, CollectionGroup, CollectionResource, Group } from '@prisma/client';
import type { ResourceWithRelations } from '../resources/resource.types.js';

export type { ActorContext } from '../resources/resource.types.js';

/** One membership row with its resource hydrated to the same depth
 * `resource.repository.ts`'s own reads use (`ResourceWithRelations`) —
 * needed because deciding whether *this* viewer may see this particular
 * item requires the identical inputs `isResourceVisibleTo` needs for a
 * standalone resource: `ownerId`, `visibility`, and `groups`. */
export type CollectionItemWithResource = CollectionResource & { resource: ResourceWithRelations };

/** The shape every collection repository read returns — a `Collection`
 * row with its ordered items (each hydrated to `ResourceWithRelations`)
 * and restricted-group rows included. Both `collection.mapper.ts` and
 * `collection.policy.ts` work from this same shape, mirroring
 * `ResourceWithRelations`'s role in the Resource module. */
export type CollectionWithRelations = Collection & {
  items: CollectionItemWithResource[];
  groups: (CollectionGroup & { group: Group })[];
};
