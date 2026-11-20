import {
  ResourceDetailSchema,
  ResourceSummarySchema,
  type PublicUser,
  type ResourceCreator,
  type ResourceDetail,
  type ResourceSummary,
} from '@academy-library/contracts';
import { resourceCapabilities } from './resource.policy.js';
import type { ResourceWithRelations } from './resource.types.js';

function toCreator(resource: ResourceWithRelations): ResourceCreator {
  return resource.creatorAffiliation
    ? { name: resource.creatorName, affiliation: resource.creatorAffiliation }
    : { name: resource.creatorName };
}

/** Shared fields between `ResourceDetailSchema` and `ResourceSummarySchema`
 * that read identically off a hydrated row — everything except `courses`
 * (summary keeps `{id,title}`, same as detail, so actually shared too) and
 * the fields each schema omits entirely (`restrictedToGroupIds`/`sourceUrl`
 * on summary). Kept as a plain object, not a shared builder, since the two
 * schemas' required-field sets differ enough that forcing one through the
 * other would need more conditionals than it saves. */
function toCourseRefs(resource: ResourceWithRelations) {
  return resource.courses.map((entry) => ({ id: entry.course.id, title: entry.course.title }));
}

function toTagNames(resource: ResourceWithRelations): string[] {
  return resource.tags.map((entry) => entry.tag.name);
}

/**
 * The only place a hydrated `Resource` row becomes the DTO a client is
 * allowed to see. `ownerId` never leaves this function's input — there is
 * no field for it in `ResourceDetailSchema`, so omitting it is structural,
 * not something this function could get wrong by forgetting a line.
 * Parses the constructed object through `ResourceDetailSchema` before
 * returning it — a runtime assertion that the database and the contract
 * actually agree on this resource's shape, not just a type-level claim.
 *
 * `actor` (Task 05C.3) is `null` for an anonymous (`optionalAuth`)
 * caller — used only to compute `capabilities`, never to decide
 * *whether* this resource is returned at all (that's
 * `isResourceVisibleTo`, already applied by the caller before this
 * function ever runs).
 */
export function toResourceDetail(
  resource: ResourceWithRelations,
  actor: Pick<PublicUser, 'id' | 'role'> | null,
): ResourceDetail {
  const base = {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    difficulty: resource.difficulty,
    creator: toCreator(resource),
    coverImageUrl: resource.coverImageUrl,
    sourceUrl: resource.sourceUrl,
    tags: toTagNames(resource),
    courses: toCourseRefs(resource),
    publishedAt: resource.publishedAt ? resource.publishedAt.toISOString() : null,
    publisher: resource.publisher,
    visibility: resource.visibility,
    restrictedToGroupIds: resource.groups.map((entry) => entry.groupId),
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    capabilities: resourceCapabilities(actor, resource),
  };

  const withType =
    resource.type === 'VIDEO' || resource.type === 'RECORDING'
      ? { ...base, type: resource.type, durationSeconds: resource.durationSeconds }
      : { ...base, type: resource.type };

  return ResourceDetailSchema.parse(withType);
}

export function toResourceSummary(resource: ResourceWithRelations): ResourceSummary {
  return ResourceSummarySchema.parse({
    id: resource.id,
    title: resource.title,
    description: resource.description,
    type: resource.type,
    difficulty: resource.difficulty,
    creator: toCreator(resource),
    coverImageUrl: resource.coverImageUrl,
    courses: toCourseRefs(resource),
    tags: toTagNames(resource),
    durationSeconds: resource.durationSeconds,
    visibility: resource.visibility,
    publishedAt: resource.publishedAt ? resource.publishedAt.toISOString() : null,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  });
}
