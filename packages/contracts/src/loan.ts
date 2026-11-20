import { z } from 'zod';
import { createPaginatedResponseSchema, ResourceSummarySchema } from './resource.js';

/**
 * Physical Library domain contracts (Task 07), continued — one
 * borrowing of one `BookCopy` by one `User`. "Reserving" a copy (the
 * task brief's "borrow/reserve") IS borrowing it in this system; there
 * is no separate hold/waitlist queue for an already-`ON_LOAN` copy — a
 * deliberate, documented scope boundary (see
 * `physicalLibrary.service.ts`), not an omission.
 */

export const LoanStatusSchema = z.enum(['ACTIVE', 'RETURNED']);
export type LoanStatus = z.infer<typeof LoanStatusSchema>;
export const LOAN_STATUSES = LoanStatusSchema.options;

/** The copy as it appears inside a Loan — just enough to identify which
 * physical item this is and which book it belongs to, reusing
 * `ResourceSummarySchema` the same way `CollectionResourceItemSchema`
 * reuses it (Task 06's precedent): a loan's book *is* a resource, no
 * parallel shape invented for it. */
export const LoanCopyRefSchema = z
  .object({
    id: z.string().min(1),
    inventoryCode: z.string().min(1),
    resource: ResourceSummarySchema,
  })
  .strict();
export type LoanCopyRef = z.infer<typeof LoanCopyRefSchema>;

/** Always present, even on `GET /loans` (self) where the viewer already
 * knows it's their own loan — one `LoanSchema` for both the self-scoped
 * and admin-wide listings (see `GET /loans/all`) rather than two
 * near-identical shapes, so there is exactly one mapper, one source of
 * truth for "what a loan looks like." `displayName` only, never email —
 * the admin-facing loan list does not need to carry a second PII field
 * beyond what `/admin/users` would eventually show anyway. */
export const LoanBorrowerRefSchema = z
  .object({ id: z.string().min(1), displayName: z.string().min(1) })
  .strict();
export type LoanBorrowerRef = z.infer<typeof LoanBorrowerRefSchema>;

export const LoanSchema = z
  .object({
    id: z.string().min(1),
    copy: LoanCopyRefSchema,
    borrower: LoanBorrowerRefSchema,
    status: LoanStatusSchema,
    borrowedAt: z.string().datetime(),
    dueAt: z.string().datetime(),
    returnedAt: z.string().datetime().nullable(),
    /** Computed server-side (`status === 'ACTIVE' && dueAt < now`), not
     * a stored column — see the `Loan` model's doc comment in
     * schema.prisma for why "overdue" is deliberately not a persisted
     * status requiring a background job to transition. */
    isOverdue: z.boolean(),
  })
  .strict();
export type Loan = z.infer<typeof LoanSchema>;

export const LoanListResponseSchema = createPaginatedResponseSchema(LoanSchema);
export type LoanListResponse = z.infer<typeof LoanListResponseSchema>;

export const LoanListQuerySchema = z.object({
  status: LoanStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});
export type LoanListQuery = z.infer<typeof LoanListQuerySchema>;

/** `POST /loans` — self-service borrow, always for the authenticated
 * caller. A specific physical copy is never chosen by the client (a
 * borrower does not care *which* copy of a title they get, only that
 * one is available) — the server picks the first available copy inside
 * the same locked transaction that creates the loan; see
 * `physicalLibrary.service.ts`'s `borrowResource`. There is no
 * "checkout on behalf of another user" input: this system has no
 * concept of a patron without their own account, so the staff-processed
 * checkout the task brief asks for is this same self-service action,
 * performed by any authenticated role (including ADMIN) for themselves
 * — not a second, parallel endpoint. */
export const LoanCreateInputSchema = z.object({ resourceId: z.string().min(1) }).strict();
export type LoanCreateInput = z.infer<typeof LoanCreateInputSchema>;

/** `PATCH /loans/:id` — the entire Loan state machine's one transition:
 * `ACTIVE -> RETURNED`, ADMIN only (a physical return is confirmed by
 * library staff, not self-reported). Rejecting any other status value
 * here, at the contract layer, mirrors `BookCopyUpdateInputSchema`'s
 * identical one-literal shape. */
export const LoanUpdateInputSchema = z.object({ status: z.literal('RETURNED') }).strict();
export type LoanUpdateInput = z.infer<typeof LoanUpdateInputSchema>;
