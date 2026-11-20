import type { PublicUser, ResourceCapabilities } from '@academy-library/contracts';
import { allOf, anyOf, hasRole, ownedBy, type Policy } from '../auth/policy.js';
import type { ActorContext, ResourceWithRelations } from './resource.types.js';

/** LECTURER or ADMIN only — `STUDENT cannot create ... resources` is a
 * named rule, not just an emergent consequence of ownership, so it is
 * checked directly rather than left implicit. */
export const canCreateResource: Policy<unknown> = hasRole('LECTURER', 'ADMIN');

/**
 * ADMIN can modify any resource; a LECTURER only one they own; nobody
 * else (including STUDENT) can modify any resource. Written as
 * `ADMIN OR (LECTURER AND owner)` rather than just `ADMIN OR owner` —
 * the latter would happen to produce the same result today (only a
 * LECTURER/ADMIN can ever become an owner, via `canCreateResource`
 * above), but this stays correct even if that stops being true later
 * (e.g. a future ownership-transfer feature), rather than relying on an
 * invariant this file doesn't enforce.
 */
export const canModifyResource: Policy<{ ownerId: string }> = anyOf(
  hasRole('ADMIN'),
  allOf(hasRole('LECTURER'), ownedBy()),
);

/**
 * Whether `actor` may see `resource` at all — the gate every read path
 * (list, search, facet counts if any existed, and single-resource fetch)
 * must apply before a resource can appear in a response. `null` actor
 * means anonymous: only `PUBLIC` resources are visible, per the
 * documented guest-access policy (see docs/domain/resources.md).
 *
 * This is deliberately NOT expressed as a `Policy<ResourceWithRelations>`
 * like `canModifyResource` above — `Policy` is synchronous and knows
 * nothing about group membership, which is async, DB-backed state
 * resolved once per request into `ActorContext.groupIds` before this
 * function runs.
 *
 * Mirrors `buildVisibilityCondition` in `resource.repository.ts` almost
 * exactly, on purpose: that function expresses the identical rule as a
 * SQL fragment so list/search can filter and paginate correctly at the
 * database layer (this function alone cannot do that — it only answers
 * the question for one already-fetched resource, used by the
 * single-resource GET path after the row is already in hand). Keeping
 * two expressions of one rule in sync is a real maintenance cost; any
 * change here must be mirrored there, and vice versa — see
 * `resources.routes.test.ts`'s "list and detail agree on visibility"
 * coverage, which exists specifically to catch the two drifting apart.
 */
export function isResourceVisibleTo(
  resource: Pick<ResourceWithRelations, 'visibility' | 'ownerId' | 'groups'>,
  actor: ActorContext | null,
): boolean {
  if (actor?.role === 'ADMIN') return true;
  if (resource.visibility === 'PUBLIC') return true;
  if (!actor) return false;
  if (resource.ownerId === actor.userId) return true;

  const restrictedGroupIds = new Set(resource.groups.map((entry) => entry.groupId));
  return actor.groupIds.some((groupId) => restrictedGroupIds.has(groupId));
}

export function toActorContext(user: PublicUser, groupIds: readonly string[]): ActorContext {
  return { userId: user.id, role: user.role, groupIds };
}

/**
 * What the given viewer may do to this specific resource (Task 05C.3) —
 * the one place `capabilities` gets computed before it's embedded in a
 * `ResourceDetail` response (see `resource.mapper.ts`'s
 * `toResourceDetail`). Edit and delete are not actually distinct rules
 * in this codebase today — both are gated by the identical
 * `canModifyResource` policy — so computing it once and reusing the
 * result for both fields is intentional, not a stand-in for two
 * different checks that happen to currently agree.
 *
 * Takes `Pick<PublicUser, 'id' | 'role'>` rather than `ActorContext`, so
 * both a write-path caller already holding a full `PublicUser`
 * (`createResource`/`updateResource`) and a read-path caller only
 * holding an `ActorContext` (`getResourceById`, which passes `{ id:
 * actor.userId, role: actor.role }`) can call this the same way.
 */
export function resourceCapabilities(
  actor: Pick<PublicUser, 'id' | 'role'> | null,
  resource: { ownerId: string },
): ResourceCapabilities {
  const canModify = actor !== null && canModifyResource(actor, resource);
  return { canEdit: canModify, canDelete: canModify };
}
