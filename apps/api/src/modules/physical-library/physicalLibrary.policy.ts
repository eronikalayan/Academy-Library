import { hasRole, type Policy } from '../auth/policy.js';

/**
 * A single flat role check, not an ownership policy (unlike
 * `canModifyResource`/`canModifyCollection`) — there is no per-copy or
 * per-loan "owner" the way those domains have one; inventory belongs to
 * the library, not to whoever registered a given copy. Covers every
 * write/staff-only read this domain has: registering or archiving a
 * `BookCopy`, marking a `Loan` as `RETURNED` (a physical return is
 * confirmed by library staff, not self-reported by the borrower — see
 * `LoanUpdateInputSchema`'s doc comment in packages/contracts), and
 * viewing the system-wide loan list (`GET /loans/all`). All four are the
 * identical rule today, so one name says so honestly rather than three
 * identically-implemented policies pretending to be independent —
 * splitting them is trivial later if that ever stops being true (see
 * `resourceCapabilities`'s doc comment in `resource.policy.ts` for the
 * same reasoning applied to Resource edit/delete). Reading
 * availability, by contrast, is open to any authenticated role — see
 * `physicalLibrary.service.ts`'s `listCopiesForResource`, which only
 * gates on the underlying resource's own visibility.
 */
export const canManageLibrary: Policy<unknown> = hasRole('ADMIN');
