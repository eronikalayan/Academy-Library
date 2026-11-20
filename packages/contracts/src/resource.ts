import { z } from 'zod';

/**
 * Resource domain contracts, shared between `apps/web` and the future
 * `apps/api` Resource endpoints. These are the only contracts for this
 * domain today — no Prisma models or CRUD routes exist yet (see
 * docs/domain/resources.md for the planned `/api/v1/resources` shape and
 * the frontend repository boundary that currently stands in for it).
 *
 * Physical copies and loans are a separate, later domain — intentionally
 * not modeled here.
 */

export const ResourceTypeSchema = z.enum([
  'BOOK',
  'ARTICLE',
  'VIDEO',
  'EXERCISE',
  'RECORDING',
  'OTHER',
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
export const RESOURCE_TYPES = ResourceTypeSchema.options;

export const ResourceDifficultySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type ResourceDifficulty = z.infer<typeof ResourceDifficultySchema>;
export const RESOURCE_DIFFICULTIES = ResourceDifficultySchema.options;

/** UI-displayable only — no authorization is implemented against this yet. */
export const ResourceVisibilitySchema = z.enum(['PUBLIC', 'RESTRICTED']);
export type ResourceVisibility = z.infer<typeof ResourceVisibilitySchema>;
export const RESOURCE_VISIBILITIES = ResourceVisibilitySchema.options;

export const ResourceSortSchema = z.enum(['relevance', 'newest', 'title_asc']);
export type ResourceSort = z.infer<typeof ResourceSortSchema>;
export const RESOURCE_SORTS = ResourceSortSchema.options;

/**
 * `z.string().url()` only guarantees well-formed URL *syntax* — it still
 * accepts schemes like `javascript:` or `data:` that must never be
 * rendered as an `href` (see `apps/web/src/shared/data/resources/url.ts`,
 * `isSafeHttpUrl`, whose own doc comment flags exactly this gap as a
 * frontend-only, render-time guard against a contract that doesn't
 * promise it). Resolved here, at the contract layer, by Task 05B: a
 * backward-compatible narrowing — anything that was previously valid
 * *and* safe still passes — so both `coverImageUrl` and `sourceUrl`
 * reject an unsafe scheme before a value is ever persisted, not just
 * before it is rendered. The frontend guard stays in place regardless,
 * as defense-in-depth against any data that predates this check.
 */
export const SafeHttpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use the http or https scheme' },
  );

export const CourseRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
});
export type CourseRef = z.infer<typeof CourseRefSchema>;

/** `GET /api/v1/groups` lists exactly this shape — groups are a small,
 * seed/admin-managed set (see docs/domain/resources.md, "Database
 * schema"), never paginated. Used by the resource create/edit form's
 * restricted-group picker. */
export const GroupRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
});
export type GroupRef = z.infer<typeof GroupRefSchema>;

/**
 * What the *current viewer* may do to a specific resource — computed
 * server-side from the real session and real ownership (see
 * `apps/api/src/modules/resources/resource.policy.ts`'s
 * `resourceCapabilities`), never left for the frontend to infer. The
 * backend deliberately does not expose `ownerId` (see
 * `ResourceDetailBase` below) — guessing capability from `creatorName`
 * or any other identity-adjacent field would be both unreliable and a
 * real authorization bug waiting to happen, so this is the one
 * supported way a client learns whether it may edit/delete a resource.
 * A frontend check against this field is a *display* convenience only;
 * the backend's own policy check on `PATCH`/`DELETE` is what actually
 * enforces it, same as every other role-gated UI affordance in this
 * app.
 */
export const ResourceCapabilitiesSchema = z.object({
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type ResourceCapabilities = z.infer<typeof ResourceCapabilitiesSchema>;

export const ResourceCreatorSchema = z.object({
  name: z.string().min(1).max(160),
  affiliation: z.string().max(160).optional(),
});
export type ResourceCreator = z.infer<typeof ResourceCreatorSchema>;

/**
 * Fields every resource shares, *excluding* `type` and the
 * course-association field — the two places read and write shapes
 * genuinely diverge (see below) — and excluding `durationSeconds`, which
 * only BOOK/ARTICLE/EXERCISE/OTHER lack entirely (VIDEO/RECORDING require
 * it, enforced per-branch below rather than as a loose optional number).
 */
const ResourceCommonFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  difficulty: ResourceDifficultySchema,
  creator: ResourceCreatorSchema,
  /** Absent for most fixtures on purpose — see docs/domain/resources.md
   * ("cover images") for why the UI never depends on a hotlinked URL. */
  coverImageUrl: SafeHttpUrlSchema.nullable().optional(),
  /** The licensed/original source. Absent when there isn't one to link to. */
  sourceUrl: SafeHttpUrlSchema.nullable().optional(),
  tags: z.array(z.string().min(1)).default([]),
  /** Only meaningful for published works (books, articles, recordings of
   * a dated talk); absent for e.g. an undated in-house exercise. */
  publishedAt: z.string().datetime().nullable().optional(),
  publisher: z.string().max(160).nullable().optional(),
  visibility: ResourceVisibilitySchema,
  /** Required (by `requireGroupsWhenRestricted` below) when `visibility`
   * is `RESTRICTED`; meaningless and left empty otherwise. */
  restrictedToGroupIds: z.array(z.string().min(1)).default([]),
});

function requireGroupsWhenRestricted(
  resource: { visibility?: ResourceVisibility; restrictedToGroupIds?: string[] },
  ctx: z.RefinementCtx,
): void {
  if (resource.visibility === 'RESTRICTED' && (resource.restrictedToGroupIds?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'restrictedToGroupIds must list at least one group when visibility is RESTRICTED',
      path: ['restrictedToGroupIds'],
    });
  }
}

// ---------------------------------------------------------------------
// Resource detail (full, single-resource representation)
// ---------------------------------------------------------------------

const ResourceSystemFields = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Reads denormalize course associations to `{ id, title }` for display,
// since there is no separate Course-lookup endpoint for the frontend to
// join against.
const ResourceDetailBase = ResourceSystemFields.merge(ResourceCommonFields).extend({
  courses: z.array(CourseRefSchema).default([]),
  capabilities: ResourceCapabilitiesSchema,
});

const ResourceDetailWithDuration = ResourceDetailBase.extend({
  durationSeconds: z.number().int().positive(),
});

// `.strict()` on every branch (not just the shared base) — these are the
// write/canonical-read boundary, where an out-of-place field (e.g.
// `durationSeconds` on a BOOK) should be rejected outright, not silently
// stripped the way a looser read contract (`ResourceSummarySchema`,
// `ResourceListQuerySchema`) tolerates for forward-compatibility.
export const ResourceDetailSchema = z
  .discriminatedUnion('type', [
    ResourceDetailBase.extend({ type: z.literal('BOOK') }).strict(),
    ResourceDetailBase.extend({ type: z.literal('ARTICLE') }).strict(),
    ResourceDetailWithDuration.extend({ type: z.literal('VIDEO') }).strict(),
    ResourceDetailBase.extend({ type: z.literal('EXERCISE') }).strict(),
    ResourceDetailWithDuration.extend({ type: z.literal('RECORDING') }).strict(),
    ResourceDetailBase.extend({ type: z.literal('OTHER') }).strict(),
  ])
  .superRefine(requireGroupsWhenRestricted);
export type ResourceDetail = z.infer<typeof ResourceDetailSchema>;

// ---------------------------------------------------------------------
// Resource summary (lighter list-view representation)
// ---------------------------------------------------------------------

/**
 * Deliberately flat, not a discriminated union like `ResourceDetailSchema`
 * — a list endpoint's job is cheap rendering, not full write-time
 * strictness, so `durationSeconds` is just a nullable number here rather
 * than branch-enforced. `sourceUrl` and `restrictedToGroupIds` are omitted
 * entirely: neither is used by card UI, so the list payload doesn't carry
 * them.
 */
export const ResourceSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  type: ResourceTypeSchema,
  difficulty: ResourceDifficultySchema,
  creator: ResourceCreatorSchema,
  coverImageUrl: SafeHttpUrlSchema.nullable().optional(),
  courses: z.array(CourseRefSchema).default([]),
  tags: z.array(z.string().min(1)).default([]),
  durationSeconds: z.number().int().positive().nullable().optional(),
  visibility: ResourceVisibilitySchema,
  publishedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ResourceSummary = z.infer<typeof ResourceSummarySchema>;

// ---------------------------------------------------------------------
// List query parameters
// ---------------------------------------------------------------------

/**
 * Parses raw query-string values (`URLSearchParams` entries are always
 * strings) into typed, bounded parameters — `.coerce` handles the
 * string-to-number conversion for `page`/`pageSize` so callers never do
 * that by hand. `sort: 'relevance'` without a `search` term is accepted
 * here (not rejected) — the repository falls back to `newest` semantics
 * in that case; the UI's job is simply not to *offer* that combination
 * (see the Library Explorer's SortSelect).
 */
export const ResourceListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: ResourceTypeSchema.optional(),
  difficulty: ResourceDifficultySchema.optional(),
  courseId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  /**
   * Added by Task 05B (the Resource backend) — absent from Task 04's
   * original query shape, which had no authorization model yet to make
   * this meaningful. Additive and optional, so every pre-existing caller
   * (the mock repository, any already-written test) keeps working
   * unchanged. Narrowing, not gating: a result is still intersected with
   * whatever the requester is actually authorized to see, so this can
   * only ever narrow a response, never widen it past that.
   */
  visibility: ResourceVisibilitySchema.optional(),
  sort: ResourceSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});
export type ResourceListQuery = z.infer<typeof ResourceListQuerySchema>;

// ---------------------------------------------------------------------
// Paginated response envelope
// ---------------------------------------------------------------------

export function createPaginatedResponseSchema<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });
}

export const ResourceSummaryListResponseSchema =
  createPaginatedResponseSchema(ResourceSummarySchema);
export type ResourceSummaryListResponse = z.infer<typeof ResourceSummaryListResponseSchema>;

// ---------------------------------------------------------------------
// Create / update input
// ---------------------------------------------------------------------

// Writes take `courseIds` (plain references); only reads denormalize to
// full `CourseRef`s, since a client creating/updating a resource knows
// which courses it belongs to by id, not their display titles.
const ResourceWritableFields = ResourceCommonFields.extend({
  courseIds: z.array(z.string().min(1)).default([]),
});

const ResourceCreateWithDuration = ResourceWritableFields.extend({
  durationSeconds: z.number().int().positive(),
});

export const ResourceCreateInputSchema = z
  .discriminatedUnion('type', [
    ResourceWritableFields.extend({ type: z.literal('BOOK') }).strict(),
    ResourceWritableFields.extend({ type: z.literal('ARTICLE') }).strict(),
    ResourceCreateWithDuration.extend({ type: z.literal('VIDEO') }).strict(),
    ResourceWritableFields.extend({ type: z.literal('EXERCISE') }).strict(),
    ResourceCreateWithDuration.extend({ type: z.literal('RECORDING') }).strict(),
    ResourceWritableFields.extend({ type: z.literal('OTHER') }).strict(),
  ])
  .superRefine(requireGroupsWhenRestricted);
export type ResourceCreateInput = z.infer<typeof ResourceCreateInputSchema>;

/**
 * Flat and fully partial (PATCH semantics), unlike Create/Detail — built
 * from scratch rather than `ResourceWritableFields.partial()` on purpose:
 * several of those fields carry `.default([])`, and a default fires for
 * an *omitted* key just as it would for one explicitly sent as
 * `undefined` — exactly the key a partial update needs to leave alone.
 * Re-declaring the fields here without defaults keeps "omitted" meaning
 * "unchanged".
 */
export const ResourceUpdateInputSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(4000).optional(),
    type: ResourceTypeSchema.optional(),
    difficulty: ResourceDifficultySchema.optional(),
    creator: ResourceCreatorSchema.optional(),
    coverImageUrl: SafeHttpUrlSchema.nullable().optional(),
    sourceUrl: SafeHttpUrlSchema.nullable().optional(),
    courseIds: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    publishedAt: z.string().datetime().nullable().optional(),
    publisher: z.string().max(160).nullable().optional(),
    durationSeconds: z.number().int().positive().nullable().optional(),
    visibility: ResourceVisibilitySchema.optional(),
    restrictedToGroupIds: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine(requireGroupsWhenRestricted);
export type ResourceUpdateInput = z.infer<typeof ResourceUpdateInputSchema>;
