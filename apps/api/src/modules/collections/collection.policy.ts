import type { CollectionCapabilities, PublicUser } from '@academy-library/contracts';
import { allOf, anyOf, hasRole, ownedBy, type Policy } from '../auth/policy.js';
import type { ActorContext, CollectionWithRelations } from './collection.types.js';

/** LECTURER or ADMIN only — identical shape to
 * `resource.policy.ts`'s `canCreateResource`, a named rule rather than
 * an emergent consequence of ownership. */
export const canCreateCollection: Policy<unknown> = hasRole('LECTURER', 'ADMIN');

/** ADMIN can modify any collection; a LECTURER only one they own;
 * nobody else (including STUDENT) can modify any collection. Governs
 * edit, delete, add/remove resource, and reorder alike — these are not
 * four distinct rules in this domain, mirroring how `canModifyResource`
 * governs both edit and delete for a Resource. */
export const canModifyCollection: Policy<{ ownerId: string }> = anyOf(
  hasRole('ADMIN'),
  allOf(hasRole('LECTURER'), ownedBy()),
);

/**
 * Whether `actor` may see `collection` at all. Deliberately **not**
 * mirroring `isResourceVisibleTo`'s guest-access rule: a Resource's
 * `PUBLIC` visibility is readable by an anonymous caller, but a
 * Collection's is not — `actor === null` returns `false`
 * unconditionally here, before `visibility` is even inspected. This is
 * an intentional, documented difference (see docs/domain/collections.md,
 * "Why PUBLIC collections still require authentication"), not an
 * oversight copied from the wrong template.
 *
 * Otherwise identical shape to `isResourceVisibleTo`: ADMIN sees
 * everything; the owner always sees their own, even `RESTRICTED`;
 * everyone else needs `PUBLIC` or membership in one of the collection's
 * restricted groups. Mirrors `buildCollectionVisibilityCondition` in
 * `collection.repository.ts` on purpose — see that function's doc
 * comment for why both exist and the maintenance cost of keeping them
 * in sync.
 */
export function isCollectionVisibleTo(
  collection: Pick<CollectionWithRelations, 'visibility' | 'ownerId' | 'groups'>,
  actor: ActorContext | null,
): boolean {
  if (actor?.role === 'ADMIN') return true;
  if (!actor) return false;
  if (collection.visibility === 'PUBLIC') return true;
  if (collection.ownerId === actor.userId) return true;

  const restrictedGroupIds = new Set(collection.groups.map((entry) => entry.groupId));
  return actor.groupIds.some((groupId) => restrictedGroupIds.has(groupId));
}

/**
 * What the given viewer may do to this specific collection — the one
 * place `capabilities` gets computed before it's embedded in a
 * `CollectionDetail` response (see `collection.mapper.ts`). Edit and
 * delete are the same rule here too, so computing once and reusing the
 * result for both fields is intentional, same as
 * `resourceCapabilities`.
 */
export function collectionCapabilities(
  actor: Pick<PublicUser, 'id' | 'role'> | null,
  collection: { ownerId: string },
): CollectionCapabilities {
  const canModify = actor !== null && canModifyCollection(actor, collection);
  return { canEdit: canModify, canDelete: canModify };
}
