import type { BookCopyStatus, LoanStatus } from '@prisma/client';
import type { ResourceWithRelations } from '../resources/resource.types.js';
import type { ListLoansParams } from './physicalLibrary.types.js';

export interface BookCopyRecord {
  id: string;
  resourceId: string;
  inventoryCode: string;
  status: BookCopyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanRecord {
  id: string;
  copyId: string;
  userId: string;
  status: LoanStatus;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  createdAt: Date;
}

export type LoanWithRelationsRecord = LoanRecord & {
  copy: BookCopyRecord & { resource: ResourceWithRelations };
  borrower: { id: string; displayName: string };
};

export interface LoanPageRecord {
  items: LoanWithRelationsRecord[];
  totalItems: number;
}

/**
 * The integration boundary the task brief asks for: "use a local
 * inventory implementation for now, but isolate it behind a clearly
 * defined integration boundary so Depot can become the authoritative
 * external provider later." `localPhysicalLibraryProvider.ts` (the only
 * implementation of this interface today) does everything listed below
 * directly against this app's own Postgres database, inside
 * transactions it owns completely — row-locking the owning `resources`
 * row for the duration of any mutation, the same way
 * `collection.repository.ts` locks a `collections` row for its own
 * add/remove/reorder operations (see `localPhysicalLibraryProvider.ts`'s
 * `lockResourceForUpdate` doc comment for the full rationale).
 *
 * A future `DepotProvider implements PhysicalLibraryProvider` — calling
 * Depot's real circulation-desk API instead of touching Postgres
 * directly — is how Depot becomes the authoritative source for physical
 * inventory and borrowing: `physicalLibrary.service.ts` (the only
 * caller of this interface), every route, every policy, every mapper,
 * and the entire frontend would need zero changes, only which concrete
 * provider gets exported as `physicalLibraryProvider` below. This
 * repository does not invent what Depot's real API looks like (the task
 * brief explicitly says not to guess external production API
 * contracts) — only this app's own internal contract that a Depot
 * adapter would need to satisfy. There is deliberately no stub/fake
 * `DepotProvider` and no provider-selecting feature flag here: isolating
 * the seam is this task's job, simulating an integration that doesn't
 * exist yet is not (the task brief explicitly warns against exactly
 * that) — and `physicalLibraryProvider` below being the one and only
 * provider in scope at any time is what keeps this a single source of
 * truth for physical inventory, never two.
 *
 * The other two integration boundaries this task names — Reel (lesson
 * recording synchronization) and Skill Map (external learning
 * recommendations) — have no feature of their own to back yet, so they
 * are documented as plain interfaces only, with no local implementation
 * at all: see `../../integrations/reel.ts` and
 * `../../integrations/skillMap.ts`.
 */
export interface PhysicalLibraryProvider {
  listCopies(resourceId: string): Promise<BookCopyRecord[]>;
  /** Used by `resource.service.ts`'s `deleteResource` to decide whether
   * deleting a resource is safe — see that function's doc comment and
   * the `BookCopy` model's doc comment in schema.prisma ("handle
   * deletion of resources with loan history safely"). Deliberately a
   * narrow count, not a full `listCopies` call: the delete-safety check
   * only needs "zero or nonzero," not the actual rows. */
  countCopiesForResource(resourceId: string): Promise<number>;
  findCopyById(copyId: string): Promise<BookCopyRecord | null>;
  registerCopy(resourceId: string, inventoryCode: string): Promise<BookCopyRecord>;
  archiveCopy(resourceId: string, copyId: string): Promise<BookCopyRecord>;

  /** Picks and locks the first available copy of `resourceId`
   * internally — the caller never chooses a specific copy (see
   * `LoanCreateInputSchema`'s doc comment in packages/contracts). */
  borrowResource(resourceId: string, userId: string): Promise<LoanWithRelationsRecord>;
  returnLoan(loanId: string): Promise<LoanWithRelationsRecord>;
  findLoanById(loanId: string): Promise<LoanWithRelationsRecord | null>;
  listLoansForUser(userId: string, params: ListLoansParams): Promise<LoanPageRecord>;
  listAllLoans(params: ListLoansParams): Promise<LoanPageRecord>;
  /** Used by `dashboard.service.ts`'s `activeLoansCount` (Task 07). */
  countActiveLoansForUser(userId: string): Promise<number>;
}
