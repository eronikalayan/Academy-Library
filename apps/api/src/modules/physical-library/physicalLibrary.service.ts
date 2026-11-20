import type {
  BookCopy,
  BookCopyListResponse,
  Loan,
  LoanListQuery,
  LoanListResponse,
  PublicUser,
} from '@academy-library/contracts';
import { AppError } from '../../errors/AppError.js';
import { authorize } from '../auth/policy.js';
import { isResourceVisibleTo } from '../resources/resource.policy.js';
import { findResourceById } from '../resources/resource.repository.js';
import { buildActorContext } from '../resources/resource.service.js';
import type { ActorContext, ResourceWithRelations } from '../resources/resource.types.js';
import { localPhysicalLibraryProvider as provider } from './localPhysicalLibraryProvider.js';
import { toBookCopy, toLoan } from './physicalLibrary.mapper.js';
import { canManageLibrary } from './physicalLibrary.policy.js';
import type { ListLoansParams } from './physicalLibrary.types.js';

/** Shared by every endpoint in this module: a resource's physical
 * copies/loans are only ever reachable through a resource the caller
 * can already see — same "visibility gates existence disclosure"
 * principle `resource.service.ts` itself documents (a `404`, not a
 * `403`, for a resource that exists but is invisible to this actor). */
async function requireVisibleResource(
  resourceId: string,
  actor: ActorContext | null,
): Promise<ResourceWithRelations> {
  const resource = await findResourceById(resourceId);
  if (!resource || !isResourceVisibleTo(resource, actor)) {
    throw AppError.notFound('Resource not found');
  }
  return resource;
}

function requireBookType(resource: ResourceWithRelations): void {
  if (resource.type !== 'BOOK') {
    throw AppError.badRequest('Physical copies only exist for BOOK resources');
  }
}

/** Open to any authenticated role — "students can view availability"
 * and "lecturers and admins can view physical inventory" are the same
 * read rule, gated only by the underlying resource's own visibility,
 * not by role. */
export async function listCopiesForResource(
  resourceId: string,
  actor: ActorContext | null,
): Promise<BookCopyListResponse> {
  await requireVisibleResource(resourceId, actor);
  const copies = await provider.listCopies(resourceId);
  return { items: copies.map(toBookCopy) };
}

export async function registerCopy(
  resourceId: string,
  inventoryCode: string,
  actingUser: PublicUser,
): Promise<BookCopy> {
  authorize(canManageLibrary, actingUser, undefined);
  const actor = await buildActorContext(actingUser);
  const resource = await requireVisibleResource(resourceId, actor);
  requireBookType(resource);
  const copy = await provider.registerCopy(resourceId, inventoryCode);
  return toBookCopy(copy);
}

export async function archiveCopy(
  resourceId: string,
  copyId: string,
  actingUser: PublicUser,
): Promise<BookCopy> {
  authorize(canManageLibrary, actingUser, undefined);
  const actor = await buildActorContext(actingUser);
  await requireVisibleResource(resourceId, actor);
  const copy = await provider.archiveCopy(resourceId, copyId);
  return toBookCopy(copy);
}

/** Self-service only — any authenticated role may borrow for
 * themselves (there is no "checkout on behalf of another user" input;
 * see `LoanCreateInputSchema`'s doc comment in packages/contracts for
 * why that is a deliberate scope decision, not a gap). */
export async function borrowResource(resourceId: string, actingUser: PublicUser): Promise<Loan> {
  const actor = await buildActorContext(actingUser);
  const resource = await requireVisibleResource(resourceId, actor);
  requireBookType(resource);
  const loan = await provider.borrowResource(resourceId, actingUser.id);
  return toLoan(loan);
}

export async function returnLoan(loanId: string, actingUser: PublicUser): Promise<Loan> {
  authorize(canManageLibrary, actingUser, undefined);
  const existing = await provider.findLoanById(loanId);
  if (!existing) throw AppError.notFound('Loan not found');
  const loan = await provider.returnLoan(loanId);
  return toLoan(loan);
}

function toListParams(query: LoanListQuery): ListLoansParams {
  return { status: query.status, page: query.page, pageSize: query.pageSize };
}

function buildListResponse(
  page: { items: Loan[]; totalItems: number },
  query: LoanListQuery,
): LoanListResponse {
  const totalPages = Math.max(1, Math.ceil(page.totalItems / query.pageSize));
  return {
    items: page.items,
    page: query.page,
    pageSize: query.pageSize,
    totalItems: page.totalItems,
    totalPages,
  };
}

/** Always self-scoped — there is no `userId` in the query, by
 * construction, the exact same "a user can never read another user's
 * own loans" guarantee `bookmark.service.ts`'s `listBookmarks`
 * documents for bookmarks. */
export async function listMyLoans(
  actingUser: PublicUser,
  query: LoanListQuery,
): Promise<LoanListResponse> {
  const { items, totalItems } = await provider.listLoansForUser(actingUser.id, toListParams(query));
  return buildListResponse({ items: items.map(toLoan), totalItems }, query);
}

export async function listAllLoans(
  actingUser: PublicUser,
  query: LoanListQuery,
): Promise<LoanListResponse> {
  authorize(canManageLibrary, actingUser, undefined);
  const { items, totalItems } = await provider.listAllLoans(toListParams(query));
  return buildListResponse({ items: items.map(toLoan), totalItems }, query);
}
