import type {
  CourseRef,
  GroupRef,
  PublicUser,
  ResourceCreateInput,
  ResourceDetail,
  ResourceListQuery,
  ResourceSummaryListResponse,
  ResourceUpdateInput,
} from '@academy-library/contracts';
import { AppError } from '../../errors/AppError.js';
import { authorize } from '../auth/policy.js';
import { localPhysicalLibraryProvider } from '../physical-library/localPhysicalLibraryProvider.js';
import { toResourceDetail, toResourceSummary } from './resource.mapper.js';
import {
  canCreateResource,
  canModifyResource,
  isResourceVisibleTo,
  toActorContext,
} from './resource.policy.js';
import {
  createResource as createResourceRow,
  deleteResource as deleteResourceRow,
  findCoursesByIds,
  findGroupsByIds,
  findResourceById,
  findVisibleResourcePage,
  getUserGroupIds,
  hydrateResources,
  listAllCourses,
  listAllGroups,
  updateResource as updateResourceRow,
  upsertTagsByNames,
  type UpdateResourceData,
} from './resource.repository.js';
import type { ActorContext, ResourceWithRelations } from './resource.types.js';

export async function listCourses(): Promise<CourseRef[]> {
  const courses = await listAllCourses();
  return courses.map((course) => ({ id: course.id, title: course.title }));
}

export async function listGroups(): Promise<GroupRef[]> {
  const groups = await listAllGroups();
  return groups.map((group) => ({ id: group.id, name: group.name }));
}

/** Trim + lowercase, the one normalization rule every tag name goes
 * through before it is stored, matched as a filter, or compared for
 * uniqueness — same discipline as `user.repository.ts`'s
 * `normalizeEmail`, applied here for consistency rather than security. */
function normalizeTagName(tag: string): string {
  return tag.trim().toLowerCase();
}

function uniqueNormalized(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

export async function buildActorContext(
  user: PublicUser | undefined,
): Promise<ActorContext | null> {
  if (!user) return null;
  const groupIds = await getUserGroupIds(user.id);
  return toActorContext(user, groupIds);
}

/** Resolves a list of course ids the caller supplied against real rows,
 * throwing a single `badRequest` naming every id that doesn't exist —
 * "Validate course/tag associations" means a client cannot silently
 * associate a resource with a course that was never created. */
async function resolveCourseIds(courseIds: readonly string[]): Promise<string[]> {
  const ids = uniqueNormalized(courseIds);
  if (ids.length === 0) return [];
  const found = await findCoursesByIds(ids);
  const foundIds = new Set(found.map((course) => course.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw AppError.badRequest('One or more courseIds do not exist', { invalidCourseIds: missing });
  }
  return ids;
}

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

async function resolveTagIds(tags: readonly string[]): Promise<string[]> {
  const names = uniqueNormalized(tags.map(normalizeTagName));
  if (names.length === 0) return [];
  const tagRows = await upsertTagsByNames(names);
  return tagRows.map((tag) => tag.id);
}

const DURATION_REQUIRED_TYPES = new Set(['VIDEO', 'RECORDING']);

export async function listResources(
  query: ResourceListQuery,
  actor: ActorContext | null,
): Promise<ResourceSummaryListResponse> {
  const { ids, totalItems } = await findVisibleResourcePage(
    {
      search: query.search,
      type: query.type,
      difficulty: query.difficulty,
      courseId: query.courseId,
      tags: query.tags?.map(normalizeTagName),
      visibility: query.visibility,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    },
    actor,
  );

  const records = await hydrateResources(ids);
  // Matches the mock repository's convention of never reporting fewer
  // than one total page, even for an empty result — see
  // docs/domain/resources.md ("Pagination"). `page` below deliberately
  // echoes the *requested* page rather than clamping it the way the mock
  // does: an out-of-range request gets a correct, empty `items` array
  // instead of a silently substituted page, which is the more
  // predictable contract for a real API (the mock's clamping exists for
  // SPA convenience, not because the contract requires it).
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: records.map(toResourceSummary),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
  };
}

export async function getResourceById(
  id: string,
  actor: ActorContext | null,
): Promise<ResourceDetail> {
  const record = await findResourceById(id);
  if (!record || !isResourceVisibleTo(record, actor)) {
    throw AppError.notFound('Resource not found');
  }
  return toResourceDetail(record, actor ? { id: actor.userId, role: actor.role } : null);
}

function splitCreator(creator: { name: string; affiliation?: string }) {
  return { creatorName: creator.name, creatorAffiliation: creator.affiliation ?? null };
}

export async function createResource(
  input: ResourceCreateInput,
  actor: PublicUser,
): Promise<ResourceDetail> {
  authorize(canCreateResource, actor, undefined);

  const [courseIds, groupIds, tagIds] = await Promise.all([
    resolveCourseIds(input.courseIds),
    resolveGroupIds(input.restrictedToGroupIds),
    resolveTagIds(input.tags),
  ]);

  const durationSeconds = 'durationSeconds' in input ? input.durationSeconds : null;
  const { creatorName, creatorAffiliation } = splitCreator(input.creator);

  const created = await createResourceRow({
    title: input.title,
    description: input.description,
    type: input.type,
    difficulty: input.difficulty,
    creatorName,
    creatorAffiliation,
    coverImageUrl: input.coverImageUrl ?? null,
    sourceUrl: input.sourceUrl ?? null,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    publisher: input.publisher ?? null,
    durationSeconds,
    visibility: input.visibility,
    ownerId: actor.id,
    tagIds,
    courseIds,
    groupIds,
  });

  return toResourceDetail(created, actor);
}

/**
 * Checks the *merged* result of applying `input` on top of `existing`
 * against the type/duration and visibility/group invariants —
 * `ResourceUpdateInputSchema` is flat and cannot see `existing`, so it
 * can only validate a payload in isolation (e.g. it catches
 * `{ visibility: 'RESTRICTED' }` with no groups in the same payload, but
 * not a payload that only clears `restrictedToGroupIds` on a resource
 * that is *already* `RESTRICTED` and omits `visibility` entirely).
 */
function validateMergedInvariants(
  existing: ResourceWithRelations,
  input: ResourceUpdateInput,
  effectiveGroupIds: readonly string[],
): void {
  const effectiveType = input.type ?? existing.type;
  const effectiveDuration =
    input.durationSeconds !== undefined ? input.durationSeconds : existing.durationSeconds;

  if (DURATION_REQUIRED_TYPES.has(effectiveType)) {
    if (effectiveDuration === null || effectiveDuration === undefined || effectiveDuration <= 0) {
      throw AppError.badRequest(`${effectiveType} resources require a positive durationSeconds`);
    }
  } else if (effectiveDuration !== null && effectiveDuration !== undefined) {
    throw AppError.badRequest(`durationSeconds is not valid for a ${effectiveType} resource`);
  }

  const effectiveVisibility = input.visibility ?? existing.visibility;
  if (effectiveVisibility === 'RESTRICTED' && effectiveGroupIds.length === 0) {
    throw AppError.badRequest(
      'restrictedToGroupIds must list at least one group when visibility is RESTRICTED',
    );
  }
}

export async function updateResource(
  id: string,
  input: ResourceUpdateInput,
  actor: PublicUser,
): Promise<ResourceDetail> {
  const actorContext = await buildActorContext(actor);
  const existing = await findResourceById(id);
  if (!existing || !isResourceVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Resource not found');
  }
  authorize(canModifyResource, actor, existing);

  const [courseIds, groupIds, tagIds] = await Promise.all([
    input.courseIds !== undefined ? resolveCourseIds(input.courseIds) : Promise.resolve(undefined),
    input.restrictedToGroupIds !== undefined
      ? resolveGroupIds(input.restrictedToGroupIds)
      : Promise.resolve(undefined),
    input.tags !== undefined ? resolveTagIds(input.tags) : Promise.resolve(undefined),
  ]);

  const effectiveGroupIds = groupIds ?? existing.groups.map((entry) => entry.groupId);
  validateMergedInvariants(existing, input, effectiveGroupIds);

  const data: UpdateResourceData = {
    title: input.title,
    description: input.description,
    type: input.type,
    difficulty: input.difficulty,
    ...(input.creator ? splitCreator(input.creator) : {}),
    coverImageUrl: input.coverImageUrl,
    sourceUrl: input.sourceUrl,
    publishedAt:
      input.publishedAt !== undefined
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : null
        : undefined,
    publisher: input.publisher,
    durationSeconds: input.durationSeconds,
    visibility: input.visibility,
    tagIds,
    courseIds,
    groupIds,
  };

  const updated = await updateResourceRow(id, data);
  return toResourceDetail(updated, actor);
}

/**
 * Task 07 — "handle deletion/archival of resources with loan history
 * safely": `BookCopy.resourceId` is a `Restrict` (not `Cascade`)
 * foreign key specifically so a raw database error is the worst case,
 * never a silent loss of loan history — but a raw `P2003` constraint
 * violation surfacing as an unhandled `500` isn't "safe" in the sense
 * the task brief means, so it's checked for explicitly here and turned
 * into a clean, actionable `409`. There is no path that lifts this
 * protection: archiving every copy of a resource does not make it
 * deletable again (an `ARCHIVED` copy still carries real loan history)
 * — by design, not an oversight, see the `BookCopy` model's doc comment
 * in schema.prisma.
 */
export async function deleteResource(id: string, actor: PublicUser): Promise<void> {
  const actorContext = await buildActorContext(actor);
  const existing = await findResourceById(id);
  if (!existing || !isResourceVisibleTo(existing, actorContext)) {
    throw AppError.notFound('Resource not found');
  }
  authorize(canModifyResource, actor, existing);

  const copyCount = await localPhysicalLibraryProvider.countCopiesForResource(id);
  if (copyCount > 0) {
    throw AppError.conflict(
      'Cannot delete a resource with physical copies on record — their loan history must be preserved',
    );
  }

  await deleteResourceRow(id);
}
