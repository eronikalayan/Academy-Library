import type { Loan, LoanListQuery, LoanListResponse } from '@academy-library/contracts';

/** The frontend's boundary onto the Physical Library's loan surface.
 * `listMine`/`listAll` are deliberately separate methods, not one
 * method with a flag — same reasoning as `bookmarkRepository` always
 * scoping to the caller: there is no "pass `all: true`" footgun a
 * component could accidentally leave on. `borrow` takes only a
 * `resourceId` — the server always picks which specific copy, see
 * `LoanCreateInputSchema`'s doc comment in packages/contracts. */
export interface LoanRepository {
  listMine(query: LoanListQuery, signal?: AbortSignal): Promise<LoanListResponse>;
  listAll(query: LoanListQuery, signal?: AbortSignal): Promise<LoanListResponse>;
  borrow(resourceId: string, signal?: AbortSignal): Promise<Loan>;
  returnLoan(loanId: string, signal?: AbortSignal): Promise<Loan>;
}
