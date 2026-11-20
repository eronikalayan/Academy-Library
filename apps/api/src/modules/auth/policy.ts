import type { PublicUser, Role } from '@academy-library/contracts';
import { AppError } from '../../errors/AppError.js';

/**
 * A policy is a predicate over (actor, subject) — the seed of an
 * object-level authorization layer for later tasks (e.g. "can this user
 * edit this specific Resource?"). There is no Resource/Course/Collection
 * model yet, so nothing here is tied to one — `ownedBy` works against
 * any shape with an `ownerId`, and a future Resource policy is just
 * `ownedBy<Resource>()` composed with `hasRole('LECTURER', 'ADMIN')` via
 * `anyOf`/`allOf`, not a new pattern.
 *
 * `actor` is narrowed to `Pick<PublicUser, 'id' | 'role'>` (Task 05C.3)
 * rather than the full `PublicUser` — every policy below only ever reads
 * `.id`/`.role`, and narrowing it lets a caller that only has an
 * `ActorContext` in hand (read paths — see `resource.service.ts`'s
 * `listResources`/`getResourceById`) pass `{ id: actor.userId, role:
 * actor.role }` directly, without needing a full `PublicUser` it was
 * never given. Every existing call site already passes a full
 * `PublicUser`, which still satisfies this narrower type — no behavior
 * change for them.
 */
export type Policy<Subject> = (actor: Pick<PublicUser, 'id' | 'role'>, subject: Subject) => boolean;

export function hasRole(...roles: readonly Role[]): Policy<unknown> {
  return (actor) => roles.includes(actor.role);
}

export function ownedBy<Subject extends { ownerId: string }>(): Policy<Subject> {
  return (actor, subject) => actor.id === subject.ownerId;
}

export function anyOf<Subject>(...policies: ReadonlyArray<Policy<Subject>>): Policy<Subject> {
  return (actor, subject) => policies.some((policy) => policy(actor, subject));
}

export function allOf<Subject>(...policies: ReadonlyArray<Policy<Subject>>): Policy<Subject> {
  return (actor, subject) => policies.every((policy) => policy(actor, subject));
}

/** Throws a 403 `AppError` (for a route handler to let propagate to the
 * shared error handler) rather than returning a boolean — the call site
 * reads as a guard clause, not a branch to remember to act on. */
export function authorize<Subject>(
  policy: Policy<Subject>,
  actor: PublicUser,
  subject: Subject,
): void {
  if (!policy(actor, subject)) {
    throw AppError.forbidden();
  }
}
