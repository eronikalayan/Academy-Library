import { Prisma } from '@prisma/client';
import type { Course, Group, Tag } from '@prisma/client';
import type {
  ResourceDifficulty,
  ResourceSort,
  ResourceType,
  ResourceVisibility,
} from '@academy-library/contracts';
import { prisma } from '../../lib/prisma.js';
import type { ActorContext, ResourceWithRelations } from './resource.types.js';

// Not type-annotated as `Prisma.ResourceInclude` — that widens the object
// to the interface and erases the literal shape Prisma's generics need to
// infer a `findMany`/`findUnique` call's actual return type (the nested
// `tag`/`course`/`group` includes disappear from the inferred result).
// `satisfies` checks it against that same interface without widening.
export const RESOURCE_INCLUDE = {
  tags: { include: { tag: true } },
  courses: { include: { course: true } },
  groups: { include: { group: true } },
} satisfies Prisma.ResourceInclude;

export interface ResourceSearchParams {
  search?: string;
  type?: ResourceType;
  difficulty?: ResourceDifficulty;
  courseId?: string;
  /** Already normalized (trimmed + lowercased) by the service — the
   * repository never re-normalizes, so it never silently diverges from
   * how tag names are normalized on write (see `resource.service.ts`). */
  tags?: string[];
  visibility?: ResourceVisibility;
  sort: ResourceSort;
  page: number;
  pageSize: number;
}

/**
 * The same "may this actor see this resource" rule as
 * `resource.policy.ts`'s `isResourceVisibleTo`, expressed as a SQL
 * fragment instead of a JS predicate — see that function's doc comment
 * for why both exist and the maintenance cost of keeping them in sync.
 * `r` is the fixed alias every caller below uses for the `resources`
 * table — exported (Task 07) so any other query that joins against
 * `resources r` can reuse the identical condition rather than
 * re-deriving it (see `bookmark.repository.ts`'s
 * `findVisibleSavedResourcePage`, which joins `saved_resources` to
 * `resources r` and needs the exact same visibility rule applied).
 */
export function buildVisibilityCondition(actor: ActorContext | null): Prisma.Sql {
  if (actor?.role === 'ADMIN') {
    return Prisma.sql`TRUE`;
  }
  if (!actor) {
    return Prisma.sql`r.visibility = 'PUBLIC'`;
  }
  const groupClause =
    actor.groupIds.length > 0
      ? Prisma.sql` OR (r.visibility = 'RESTRICTED' AND EXISTS (
          SELECT 1 FROM resource_groups rg
          WHERE rg."resourceId" = r.id AND rg."groupId" IN (${Prisma.join(actor.groupIds)})
        ))`
      : Prisma.empty;
  return Prisma.sql`(r.visibility = 'PUBLIC' OR r."ownerId" = ${actor.userId}${groupClause})`;
}

function buildFilterConditions(params: ResourceSearchParams): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (params.type) {
    conditions.push(Prisma.sql`r.type = ${params.type}::"ResourceType"`);
  }
  if (params.difficulty) {
    conditions.push(Prisma.sql`r.difficulty = ${params.difficulty}::"ResourceDifficulty"`);
  }
  if (params.visibility) {
    conditions.push(Prisma.sql`r.visibility = ${params.visibility}::"ResourceVisibility"`);
  }
  if (params.courseId) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM resource_courses rc
      WHERE rc."resourceId" = r.id AND rc."courseId" = ${params.courseId}
    )`);
  }
  if (params.tags && params.tags.length > 0) {
    // OR within the tag facet (any selected tag matches), matching the
    // mock repository's documented convention (see
    // docs/domain/resources.md, "Tag filtering is OR-within-the-facet").
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM resource_tags rt
      JOIN tags t ON t.id = rt."tagId"
      WHERE rt."resourceId" = r.id AND t.name IN (${Prisma.join(params.tags)})
    )`);
  }

  return conditions;
}

/** `websearch_to_tsquery` (not `to_tsquery`) is the deliberate choice —
 * it never throws on punctuation or otherwise malformed input the way
 * `to_tsquery`'s boolean-operator syntax can, which is exactly the
 * "handle punctuation and unusual search terms safely" requirement. The
 * `%` operator is `pg_trgm`'s similarity test; combined with `ILIKE` so
 * a short substring that falls under the similarity threshold (e.g. a
 * 3-4 character tag) still matches by plain substring containment. */
function buildSearchCondition(search: string): Prisma.Sql {
  return Prisma.sql`(
    r."searchVector" @@ websearch_to_tsquery('english', ${search})
    OR EXISTS (
      SELECT 1 FROM resource_tags rt
      JOIN tags t ON t.id = rt."tagId"
      WHERE rt."resourceId" = r.id AND (t.name % ${search} OR t.name ILIKE ${'%' + search + '%'})
    )
  )`;
}

/** A fixed boost, not a weighted `ts_rank` component — a tag match comes
 * from a different table via a join, not from `searchVector` itself (see
 * the `Resource.searchVector` doc comment in schema.prisma for why), so
 * it cannot participate in the same weighted rank the way title/creator/
 * publisher/description do. Documented limitation, not an oversight. */
function buildRankExpression(search: string): Prisma.Sql {
  return Prisma.sql`(
    ts_rank_cd(r."searchVector", websearch_to_tsquery('english', ${search}))
    + CASE WHEN EXISTS (
        SELECT 1 FROM resource_tags rt
        JOIN tags t ON t.id = rt."tagId"
        WHERE rt."resourceId" = r.id AND (t.name % ${search} OR t.name ILIKE ${'%' + search + '%'})
      ) THEN 0.1 ELSE 0 END
  )`;
}

/** Every branch ends in an explicit tie-breaker (`r.id`) — `createdAt`
 * and `title` are not unique, so without one, equal-ranked rows could
 * reorder between identical requests (e.g. across two pages of the same
 * query), which would make pagination silently drop or repeat rows. */
function buildOrderClause(sort: ResourceSort, hasSearch: boolean): Prisma.Sql {
  if (sort === 'relevance' && hasSearch) {
    return Prisma.sql`ORDER BY rank DESC, r."createdAt" DESC, r.id DESC`;
  }
  if (sort === 'title_asc') {
    return Prisma.sql`ORDER BY r.title ASC, r.id ASC`;
  }
  // 'newest', and 'relevance' requested with no search term to rank
  // against — same documented fallback as the mock repository.
  return Prisma.sql`ORDER BY r."createdAt" DESC, r.id DESC`;
}

interface ResourcePage {
  ids: string[];
  totalItems: number;
}

/**
 * Returns the authorized, filtered, paginated page of resource ids plus
 * the total count *after* authorization — never the raw match count — so
 * a restricted resource the caller cannot see can never inflate
 * `totalItems`/`totalPages` the way it would if filtering happened in
 * application code after an unfiltered count. Two queries (count, then
 * ids), not one query with `COUNT(*) OVER()`: that single-query trick
 * cannot return a count on an out-of-range page, since there are no rows
 * left after `LIMIT`/`OFFSET` to attach the window value to — two
 * queries sharing the same WHERE clause is simpler and has no such edge
 * case. Both reuse the identical `Prisma.sql` fragments, so count and
 * page can never disagree with each other.
 */
export async function findVisibleResourcePage(
  params: ResourceSearchParams,
  actor: ActorContext | null,
): Promise<ResourcePage> {
  const conditions = [buildVisibilityCondition(actor), ...buildFilterConditions(params)];
  if (params.search) {
    conditions.push(buildSearchCondition(params.search));
  }
  const whereClause = Prisma.join(conditions, ' AND ');

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM resources r WHERE ${whereClause}`,
  );
  const totalItems = Number(countRows[0]?.count ?? 0n);
  if (totalItems === 0) {
    return { ids: [], totalItems: 0 };
  }

  const orderClause = buildOrderClause(params.sort, Boolean(params.search));
  const offset = (params.page - 1) * params.pageSize;
  const rankSelect = params.search
    ? Prisma.sql`${buildRankExpression(params.search)} AS rank,`
    : Prisma.empty;

  const idRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT r.id, ${rankSelect} r."createdAt", r.title
    FROM resources r
    WHERE ${whereClause}
    ${orderClause}
    LIMIT ${params.pageSize} OFFSET ${offset}
  `);

  return { ids: idRows.map((row) => row.id), totalItems };
}

/** Hydrates ids into full rows (tags/courses/groups included) in exactly
 * one query, then re-orders in memory to match `ids` — `findMany` with
 * `id: { in: ids }` does not preserve input order, and re-sorting by a
 * `Map` lookup here is O(n), not an extra query, so this stays a fixed
 * two-query list request (one from `findVisibleResourcePage`, one here)
 * regardless of page size — no N+1. */
export async function hydrateResources(ids: string[]): Promise<ResourceWithRelations[]> {
  if (ids.length === 0) return [];
  const records = await prisma.resource.findMany({
    where: { id: { in: ids } },
    include: RESOURCE_INCLUDE,
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  const ordered: ResourceWithRelations[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (record) ordered.push(record);
  }
  return ordered;
}

export function findResourceById(id: string): Promise<ResourceWithRelations | null> {
  return prisma.resource.findUnique({ where: { id }, include: RESOURCE_INCLUDE });
}

/** A standalone count, not `findVisibleResourcePage(..., { pageSize: 1
 * }).totalItems` — that would also fetch and hydrate one full resource
 * row only to discard it. Used by `dashboard.service.ts`'s
 * `totalAccessibleResources` (Task 07), which needs only the number. */
export async function countVisibleResources(actor: ActorContext | null): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM resources r WHERE ${buildVisibilityCondition(actor)}`,
  );
  return Number(rows[0]?.count ?? 0n);
}

export async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return memberships.map((membership) => membership.groupId);
}

export function findCoursesByIds(ids: string[]): Promise<Course[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.course.findMany({ where: { id: { in: ids } } });
}

export function findGroupsByIds(ids: string[]): Promise<Group[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.group.findMany({ where: { id: { in: ids } } });
}

/** Both courses and groups are small, seed/admin-managed sets (see
 * docs/architecture/decisions.md) — a plain, unpaginated `findMany` is
 * the whole query, not a stand-in for a paginated listing this domain
 * doesn't have. Used only by the resource create/edit form's course and
 * restricted-group pickers (Task 05C.3) — see `routes/metadata.routes.ts`. */
export function listAllCourses(): Promise<Course[]> {
  return prisma.course.findMany({ orderBy: { title: 'asc' } });
}

export function listAllGroups(): Promise<Group[]> {
  return prisma.group.findMany({ orderBy: { name: 'asc' } });
}

/** Tags are a folksonomy, not a curated/seed-managed entity like Course
 * or Group (see the `Tag` model's doc comment in schema.prisma) — a
 * resource create/update that mentions a new tag name creates it, rather
 * than rejecting an "unknown" tag the way an unrecognized `courseId`
 * is rejected. `names` must already be normalized (trim + lowercase) by
 * the caller. Runs each find-or-create inside the caller's transaction
 * (see `resource.service.ts`) via the ambient `prisma` client — there is
 * no separate `tx` parameter because this project's Prisma client is a
 * single shared instance and `$transaction` callbacks receive the same
 * instance type, not a distinct one. */
export async function upsertTagsByNames(names: string[]): Promise<Tag[]> {
  if (names.length === 0) return [];
  const tags: Tag[] = [];
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    tags.push(tag);
  }
  return tags;
}

export interface CreateResourceData {
  title: string;
  description: string;
  type: ResourceType;
  difficulty: ResourceDifficulty;
  creatorName: string;
  creatorAffiliation?: string | null;
  coverImageUrl?: string | null;
  sourceUrl?: string | null;
  publishedAt?: Date | null;
  publisher?: string | null;
  durationSeconds?: number | null;
  visibility: ResourceVisibility;
  ownerId: string;
  tagIds: string[];
  courseIds: string[];
  groupIds: string[];
}

export async function createResource(data: CreateResourceData): Promise<ResourceWithRelations> {
  const created = await prisma.resource.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      difficulty: data.difficulty,
      creatorName: data.creatorName,
      creatorAffiliation: data.creatorAffiliation ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      publishedAt: data.publishedAt ?? null,
      publisher: data.publisher ?? null,
      durationSeconds: data.durationSeconds ?? null,
      visibility: data.visibility,
      ownerId: data.ownerId,
      tags: { create: data.tagIds.map((tagId) => ({ tagId })) },
      courses: { create: data.courseIds.map((courseId) => ({ courseId })) },
      groups: { create: data.groupIds.map((groupId) => ({ groupId })) },
    },
    include: RESOURCE_INCLUDE,
  });
  return created;
}

export interface UpdateResourceData {
  title?: string;
  description?: string;
  type?: ResourceType;
  difficulty?: ResourceDifficulty;
  creatorName?: string;
  creatorAffiliation?: string | null;
  coverImageUrl?: string | null;
  sourceUrl?: string | null;
  publishedAt?: Date | null;
  publisher?: string | null;
  durationSeconds?: number | null;
  visibility?: ResourceVisibility;
  /** `undefined` = leave associations unchanged (PATCH semantics);
   * an array (including `[]`) = replace them entirely. */
  tagIds?: string[];
  courseIds?: string[];
  groupIds?: string[];
}

/**
 * A single transaction: the scalar-field update and each touched
 * association's delete-then-recreate must commit together, or a crash
 * mid-update could leave e.g. new scalar fields saved against stale
 * course associations. Associations are only touched when the caller
 * actually included that field — `undefined` here always means
 * "unchanged", never "clear" (clearing is `[]`, sent explicitly), the
 * same omitted-vs-explicit distinction `ResourceUpdateInputSchema` itself
 * is built to preserve.
 */
export async function updateResource(
  id: string,
  data: UpdateResourceData,
): Promise<ResourceWithRelations> {
  await prisma.$transaction(async (tx) => {
    await tx.resource.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        difficulty: data.difficulty,
        creatorName: data.creatorName,
        creatorAffiliation: data.creatorAffiliation,
        coverImageUrl: data.coverImageUrl,
        sourceUrl: data.sourceUrl,
        publishedAt: data.publishedAt,
        publisher: data.publisher,
        durationSeconds: data.durationSeconds,
        visibility: data.visibility,
      },
    });

    if (data.tagIds !== undefined) {
      await tx.resourceTag.deleteMany({ where: { resourceId: id } });
      if (data.tagIds.length > 0) {
        await tx.resourceTag.createMany({
          data: data.tagIds.map((tagId) => ({ resourceId: id, tagId })),
        });
      }
    }
    if (data.courseIds !== undefined) {
      await tx.resourceCourse.deleteMany({ where: { resourceId: id } });
      if (data.courseIds.length > 0) {
        await tx.resourceCourse.createMany({
          data: data.courseIds.map((courseId) => ({ resourceId: id, courseId })),
        });
      }
    }
    if (data.groupIds !== undefined) {
      await tx.resourceGroup.deleteMany({ where: { resourceId: id } });
      if (data.groupIds.length > 0) {
        await tx.resourceGroup.createMany({
          data: data.groupIds.map((groupId) => ({ resourceId: id, groupId })),
        });
      }
    }
  });

  const updated = await findResourceById(id);
  // The row was just updated inside the transaction above by the same
  // id this function was called with — it cannot have vanished between
  // that commit and this read.
  if (!updated) throw new Error(`Resource ${id} disappeared immediately after update`);
  return updated;
}

export async function deleteResource(id: string): Promise<void> {
  await prisma.resource.delete({ where: { id } });
}
