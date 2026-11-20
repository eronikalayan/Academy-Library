import { z } from 'zod';
import {
  createPaginatedResponseSchema,
  ResourceSummarySchema,
  SafeHttpUrlSchema,
} from './resource.js';

/**
 * Collections domain contracts (Task 06) — an ordered, named grouping of
 * resources a LECTURER/ADMIN curates. Deliberately reuses
 * `ResourceSummarySchema` for each item rather than inventing a parallel
 * "resource as seen from a collection" shape: a collection item *is* a
 * resource, just with a `position` attached (see
 * `CollectionResourceItemSchema` below).
 */

export const CollectionVisibilitySchema = z.enum(['PUBLIC', 'RESTRICTED']);
export type CollectionVisibility = z.infer<typeof CollectionVisibilitySchema>;
export const COLLECTION_VISIBILITIES = CollectionVisibilitySchema.options;

export const CollectionSortSchema = z.enum(['newest', 'title_asc']);
export type CollectionSort = z.infer<typeof CollectionSortSchema>;
export const COLLECTION_SORTS = CollectionSortSchema.options;

/**
 * What the *current viewer* may do to a specific collection — computed
 * server-side (see `apps/api/src/modules/collections/collection.policy.ts`),
 * following the exact same pattern as `ResourceCapabilitiesSchema`: the
 * backend never exposes a collection's `ownerId`, so this is the one
 * supported way a client learns whether it may edit/delete a collection
 * or change its resource membership/order (one policy governs all of
 * those, same as the Resource domain's edit/delete).
 */
export const CollectionCapabilitiesSchema = z.object({
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type CollectionCapabilities = z.infer<typeof CollectionCapabilitiesSchema>;

const CollectionSystemFields = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CollectionWritableFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  coverImageUrl: SafeHttpUrlSchema.nullable().optional(),
  visibility: CollectionVisibilitySchema,
  /** Required (by `requireGroupsWhenRestricted` below) when `visibility`
   * is `RESTRICTED`; meaningless and left empty otherwise — identical
   * rule to `Resource.restrictedToGroupIds`. */
  restrictedToGroupIds: z.array(z.string().min(1)).default([]),
});

function requireGroupsWhenRestricted(
  collection: { visibility?: CollectionVisibility; restrictedToGroupIds?: string[] },
  ctx: z.RefinementCtx,
): void {
  if (
    collection.visibility === 'RESTRICTED' &&
    (collection.restrictedToGroupIds?.length ?? 0) === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'restrictedToGroupIds must list at least one group when visibility is RESTRICTED',
      path: ['restrictedToGroupIds'],
    });
  }
}

/** One resource as it appears inside a collection — `resource` is the
 * exact same `ResourceSummarySchema` shape the Library Explorer already
 * renders, so a collection's item list can reuse `ResourceCard` as-is.
 * Only ever contains resources the *current viewer* can independently
 * see (see docs/domain/collections.md, "Resource visibility interacts
 * independently with collection visibility") — a resource this viewer
 * cannot access is omitted from this array entirely, never included
 * with placeholder/redacted fields. */
export const CollectionResourceItemSchema = z.object({
  resource: ResourceSummarySchema,
  position: z.number().int().nonnegative(),
});
export type CollectionResourceItem = z.infer<typeof CollectionResourceItemSchema>;

// ---------------------------------------------------------------------
// Collection detail (full, single-collection representation)
// ---------------------------------------------------------------------

export const CollectionDetailSchema = CollectionSystemFields.merge(CollectionWritableFields)
  .extend({
    capabilities: CollectionCapabilitiesSchema,
    /** Ordered by `position` ascending — already the *viewer-filtered*
     * count of items, not the collection's raw membership size (see
     * `resourceCount` below, same rule). */
    resources: z.array(CollectionResourceItemSchema).default([]),
  })
  .strict()
  .superRefine(requireGroupsWhenRestricted);
export type CollectionDetail = z.infer<typeof CollectionDetailSchema>;

// ---------------------------------------------------------------------
// Collection summary (lighter list-view representation)
// ---------------------------------------------------------------------

/** Deliberately flat and not `.strict()` — same reasoning as
 * `ResourceSummarySchema`: a list endpoint's job is cheap, forward-
 * compatible rendering, not write-time strictness. Omits
 * `restrictedToGroupIds` (not needed by card UI, same as Resource's
 * summary). */
export const CollectionSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  coverImageUrl: SafeHttpUrlSchema.nullable().optional(),
  visibility: CollectionVisibilitySchema,
  /** The count of items *this viewer* can see in the collection — never
   * the raw row count in `collection_resources`, which could include
   * resources restricted away from this specific viewer (see
   * `CollectionResourceItemSchema`'s doc comment — the identical rule,
   * applied to a count instead of a list). */
  resourceCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CollectionSummary = z.infer<typeof CollectionSummarySchema>;

export const CollectionSummaryListResponseSchema =
  createPaginatedResponseSchema(CollectionSummarySchema);
export type CollectionSummaryListResponse = z.infer<typeof CollectionSummaryListResponseSchema>;

// ---------------------------------------------------------------------
// List query parameters
// ---------------------------------------------------------------------

export const CollectionListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  visibility: CollectionVisibilitySchema.optional(),
  sort: CollectionSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});
export type CollectionListQuery = z.infer<typeof CollectionListQuerySchema>;

// ---------------------------------------------------------------------
// Create / update input
// ---------------------------------------------------------------------

export const CollectionCreateInputSchema = CollectionWritableFields.strict().superRefine(
  requireGroupsWhenRestricted,
);
export type CollectionCreateInput = z.infer<typeof CollectionCreateInputSchema>;

/** Flat and fully partial (PATCH semantics) — same reasoning as
 * `ResourceUpdateInputSchema`: re-declared from scratch, not
 * `CollectionWritableFields.partial()`, because `restrictedToGroupIds`
 * carries `.default([])` there, and a default fires for an *omitted*
 * key exactly as it would for one sent as `undefined` — precisely the
 * key a PATCH body needs to leave alone. */
export const CollectionUpdateInputSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(4000).optional(),
    coverImageUrl: SafeHttpUrlSchema.nullable().optional(),
    visibility: CollectionVisibilitySchema.optional(),
    restrictedToGroupIds: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine(requireGroupsWhenRestricted);
export type CollectionUpdateInput = z.infer<typeof CollectionUpdateInputSchema>;

// ---------------------------------------------------------------------
// Resource membership / ordering mutations
// ---------------------------------------------------------------------

export const CollectionResourceAddInputSchema = z
  .object({ resourceId: z.string().min(1) })
  .strict();
export type CollectionResourceAddInput = z.infer<typeof CollectionResourceAddInputSchema>;

/**
 * `PATCH /collections/:id/resources/order` takes the *entire* new order
 * as a flat, deduplicated-by-construction array of resource ids — not a
 * single moved-item delta — so the server can validate it as a set
 * (must match the collection's current membership exactly, see
 * `collection.service.ts`) and apply it atomically in one pass, rather
 * than interpreting a sequence of incremental move operations.
 */
export const CollectionResourceOrderInputSchema = z
  .object({ resourceIds: z.array(z.string().min(1)) })
  .strict();
export type CollectionResourceOrderInput = z.infer<typeof CollectionResourceOrderInputSchema>;
