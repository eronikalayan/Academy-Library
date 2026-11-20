import {
  ResourceDetailSchema,
  type ResourceCreateInput,
  type ResourceDetail,
  type ResourceListQuery,
  type ResourceSummary,
  type ResourceSummaryListResponse,
  type ResourceUpdateInput,
} from '@academy-library/contracts';
import { ApiError } from '../../api/ApiError';
import { getCourseRefs } from './courses';
import type { ResourceRepository } from './ResourceRepository';
import { toResourceDetail, toResourceSummary } from './mapFixtureToContract';
import { RESOURCE_FIXTURES } from './resourceFixtures';

function notFoundError(id: string): ApiError {
  return new ApiError(404, { error: { message: `Resource ${id} not found`, code: 'NOT_FOUND' } });
}

/** `ResourceDetail`'s extra fields (`sourceUrl`, `restrictedToGroupIds`,
 * `capabilities`, `publisher`) have no place in `ResourceSummary` — built
 * explicitly, field by field, rather than destructuring a detail object
 * and omitting keys: `ResourceDetail` is a discriminated union, and TS
 * cannot narrow an object-rest spread back down to `ResourceSummary`'s
 * flat shape cleanly. */
function toSummaryFromDetail(detail: ResourceDetail): ResourceSummary {
  return {
    id: detail.id,
    title: detail.title,
    description: detail.description,
    type: detail.type,
    difficulty: detail.difficulty,
    creator: detail.creator,
    coverImageUrl: detail.coverImageUrl,
    courses: detail.courses,
    tags: detail.tags,
    durationSeconds: 'durationSeconds' in detail ? detail.durationSeconds : null,
    visibility: detail.visibility,
    publishedAt: detail.publishedAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function matchesSearchTerm(summary: ResourceSummary, term: string): boolean {
  const haystack = [summary.title, summary.description, summary.creator.name, ...summary.tags]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

/** Simple weighted relevance: title match beats a tag match beats a
 * description-only match. Good enough for ranking fixture data — not a
 * real search-relevance algorithm. */
function relevanceScore(summary: ResourceSummary, term: string): number {
  const title = summary.title.toLowerCase();
  const description = summary.description.toLowerCase();
  const tags = summary.tags.map((tag) => tag.toLowerCase());
  let score = 0;
  if (title.includes(term)) score += 3;
  if (tags.some((tag) => tag.includes(term))) score += 2;
  if (description.includes(term)) score += 1;
  return score;
}

function compareByCreatedAtDesc(a: ResourceSummary, b: ResourceSummary): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function compareByTitleAsc(a: ResourceSummary, b: ResourceSummary): number {
  return a.title.localeCompare(b.title);
}

/**
 * A deterministic, in-memory stand-in for the real `/api/v1/resources`
 * endpoints — isolated tests/dev scenarios only, never the production
 * repository (see `shared/data/resources/index.ts`). `create`/`update`/
 * `delete` genuinely mutate this instance's in-memory maps (Task
 * 05C.3) — the fixtures are still fixed at module load, but a resource
 * created/edited/deleted through this repository stays that way for
 * subsequent calls on the *same instance*, which is what makes it
 * useful for manual dev-mode testing of the create/edit/delete UI
 * without a running backend. There is no real auth/ownership model
 * here, so `create` grants the "mock creator" full capabilities on
 * what they just made, and pre-existing fixtures default to neither
 * (see `mapFixtureToContract.ts`) — tests that need a *specific*
 * capability state register their own MSW handler instead of relying
 * on this default (see `test/mswHandlers.ts`). Search/filter/sort/
 * pagination semantics are written to match what the real backend does,
 * so swapping in `HttpResourceRepository` doesn't change UI behavior.
 */
export class MockResourceRepository implements ResourceRepository {
  private readonly summariesById: Map<string, ResourceSummary>;
  private readonly detailsById: Map<string, ResourceDetail>;

  constructor() {
    this.summariesById = new Map(
      RESOURCE_FIXTURES.map((record) => [record.id, toResourceSummary(record)]),
    );
    this.detailsById = new Map(
      RESOURCE_FIXTURES.map((record) => [record.id, toResourceDetail(record)]),
    );
  }

  list(query: ResourceListQuery, _signal?: AbortSignal): Promise<ResourceSummaryListResponse> {
    const term = query.search?.trim().toLowerCase() || undefined;

    const filtered = [...this.summariesById.values()].filter((summary) => {
      if (term && !matchesSearchTerm(summary, term)) return false;
      if (query.type && summary.type !== query.type) return false;
      if (query.difficulty && summary.difficulty !== query.difficulty) return false;
      if (query.courseId && !summary.courses.some((course) => course.id === query.courseId)) {
        return false;
      }
      // Multiple selected tags are OR'd together (match any), while every
      // other filter is AND'd with the rest — a faceted-search convention,
      // not a special case: picking more tags should widen a topic search,
      // not narrow it to resources carrying every tag at once.
      if (query.tags && query.tags.length > 0) {
        const summaryTags = new Set(summary.tags);
        if (!query.tags.some((tag) => summaryTags.has(tag))) return false;
      }
      return true;
    });

    const sorted =
      query.sort === 'relevance' && term
        ? [...filtered].sort((a, b) => {
            const diff = relevanceScore(b, term) - relevanceScore(a, term);
            return diff !== 0 ? diff : compareByCreatedAtDesc(a, b);
          })
        : query.sort === 'title_asc'
          ? [...filtered].sort(compareByTitleAsc)
          : // 'newest', and 'relevance' requested with no search term to
            // rank relevance against.
            [...filtered].sort(compareByCreatedAtDesc);

    const totalItems = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    // Echoes the *requested* page rather than clamping it to the last
    // valid one — matching the real backend's documented behavior
    // exactly (see docs/domain/resources.md, "Contract changes... /
    // Pagination"), so an out-of-range page returns a correct, empty
    // `items` array under both repositories instead of two different
    // behaviors depending on which one happens to be active. This is a
    // deliberate change from this mock's original behavior (Task 04),
    // made specifically so the mock stays a faithful stand-in once a
    // real backend exists to compare it against — not a standalone
    // design choice made in isolation here.
    const start = (query.page - 1) * query.pageSize;
    const items = sorted.slice(start, start + query.pageSize);

    return Promise.resolve({
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    });
  }

  getById(id: string, _signal?: AbortSignal): Promise<ResourceDetail | null> {
    return Promise.resolve(this.detailsById.get(id) ?? null);
  }

  create(input: ResourceCreateInput, _signal?: AbortSignal): Promise<ResourceDetail> {
    const now = new Date().toISOString();
    const id = `mock-${this.detailsById.size + 1}-${Math.random().toString(36).slice(2, 8)}`;
    // `courseIds` has no place in `ResourceDetailSchema` (it wants the
    // denormalized `courses` refs instead) — destructured out rather
    // than spread, since every detail branch is `.strict()` and would
    // reject it as an unrecognized key. Validated through the real
    // contract schema, same discipline as `resource.mapper.ts` on the
    // backend — a constructed object is never trusted structurally just
    // because it compiles.
    const { courseIds, ...rest } = input;
    const detail = ResourceDetailSchema.parse({
      ...rest,
      id,
      courses: getCourseRefs(courseIds),
      createdAt: now,
      updatedAt: now,
      capabilities: { canEdit: true, canDelete: true },
    });

    this.detailsById.set(id, detail);
    this.summariesById.set(id, toSummaryFromDetail(detail));
    return Promise.resolve(detail);
  }

  update(id: string, input: ResourceUpdateInput, _signal?: AbortSignal): Promise<ResourceDetail> {
    const existing = this.detailsById.get(id);
    if (!existing) return Promise.reject(notFoundError(id));

    const { courseIds, ...rest } = input;
    const merged = ResourceDetailSchema.parse({
      ...existing,
      ...rest,
      courses: courseIds !== undefined ? getCourseRefs(courseIds) : existing.courses,
      updatedAt: new Date().toISOString(),
    });

    this.detailsById.set(id, merged);
    this.summariesById.set(id, toSummaryFromDetail(merged));
    return Promise.resolve(merged);
  }

  delete(id: string, _signal?: AbortSignal): Promise<void> {
    if (!this.detailsById.has(id)) return Promise.reject(notFoundError(id));
    this.detailsById.delete(id);
    this.summariesById.delete(id);
    return Promise.resolve();
  }
}

export const mockResourceRepository = new MockResourceRepository();
