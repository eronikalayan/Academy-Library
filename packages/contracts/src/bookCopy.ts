import { z } from 'zod';

/**
 * Physical Library domain contracts (Task 07) — one physical, shelvable
 * copy of a `BOOK`-type Resource. See
 * `apps/api/src/modules/physical-library/physicalLibrary.provider.ts`
 * for the local/Depot integration boundary these contracts sit in front
 * of; the shapes here describe this app's own REST surface, not any
 * external Depot API.
 *
 * No `capabilities` field, unlike `CollectionDetail`/`ResourceDetail`:
 * managing inventory (registering/archiving a copy) is a flat role
 * check (`ADMIN` only), not a per-row ownership question — the same
 * reasoning `RequireRole` already applies to `/library/new` and
 * `/collections/new`, just extended to this domain's one mutation
 * surface.
 */

export const BookCopyStatusSchema = z.enum(['AVAILABLE', 'ON_LOAN', 'ARCHIVED']);
export type BookCopyStatus = z.infer<typeof BookCopyStatusSchema>;
export const BOOK_COPY_STATUSES = BookCopyStatusSchema.options;

export const BookCopySchema = z
  .object({
    id: z.string().min(1),
    resourceId: z.string().min(1),
    inventoryCode: z.string().min(1).max(64),
    status: BookCopyStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type BookCopy = z.infer<typeof BookCopySchema>;

/** `GET /resources/:resourceId/copies` — flat, unpaginated (same
 * reasoning as `CourseRef`/`GroupRef`: the number of physical copies of
 * one book is always small in practice, not a system-wide listing). */
export const BookCopyListResponseSchema = z.object({ items: z.array(BookCopySchema) }).strict();
export type BookCopyListResponse = z.infer<typeof BookCopyListResponseSchema>;

export const BookCopyCreateInputSchema = z
  .object({ inventoryCode: z.string().trim().min(1).max(64) })
  .strict();
export type BookCopyCreateInput = z.infer<typeof BookCopyCreateInputSchema>;

/** The entire BookCopy state machine's one client-facing direct
 * transition: `AVAILABLE -> ARCHIVED`. `ON_LOAN -> ARCHIVED` is never
 * allowed directly (a copy must be returned first, via the Loan
 * lifecycle) — rejecting any other status value here, at the contract
 * layer, is the first of several enforcement layers (see
 * `physicalLibrary.service.ts` for the rest). */
export const BookCopyUpdateInputSchema = z.object({ status: z.literal('ARCHIVED') }).strict();
export type BookCopyUpdateInput = z.infer<typeof BookCopyUpdateInputSchema>;
