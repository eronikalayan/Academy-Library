import { z } from 'zod';
import { createPaginatedResponseSchema, ResourceSummarySchema } from './resource.js';

/**
 * Bookmarks domain contracts (Task 06) — a user's personal "saved for
 * later" marker on a resource. Deliberately much smaller than the
 * Collections contracts: no ownership question beyond "is this the
 * current session's own bookmark" (enforced by the route always scoping
 * to `req.authUser`, never a client-supplied `userId`), no visibility of
 * its own, no ordering.
 */

/** A single saved resource, as returned by `GET /bookmarks` — `resource`
 * is the same `ResourceSummarySchema` shape every other list in this app
 * renders. A bookmark whose resource has since become inaccessible to
 * this viewer (visibility changed, group membership lost) is omitted
 * from the list entirely rather than returned with a redacted resource
 * — see docs/domain/collections.md ("Bookmarks respect current Resource
 * visibility"). */
export const BookmarkSchema = z
  .object({
    resource: ResourceSummarySchema,
    createdAt: z.string().datetime(),
  })
  .strict();
export type Bookmark = z.infer<typeof BookmarkSchema>;

export const BookmarkListResponseSchema = createPaginatedResponseSchema(BookmarkSchema);
export type BookmarkListResponse = z.infer<typeof BookmarkListResponseSchema>;

export const BookmarkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});
export type BookmarkListQuery = z.infer<typeof BookmarkListQuerySchema>;

export const BookmarkCreateInputSchema = z.object({ resourceId: z.string().min(1) }).strict();
export type BookmarkCreateInput = z.infer<typeof BookmarkCreateInputSchema>;

/** `GET /bookmarks/:resourceId/status` (Task 07) — a cheap, accurate
 * "have I saved this one resource" check, independent of how many
 * resources the caller has saved in total. Replaces deriving saved
 * status from a capped page of `GET /bookmarks`, which was wrong for
 * any resource beyond that page's size. */
export const BookmarkStatusSchema = z
  .object({ resourceId: z.string().min(1), isSaved: z.boolean() })
  .strict();
export type BookmarkStatus = z.infer<typeof BookmarkStatusSchema>;
