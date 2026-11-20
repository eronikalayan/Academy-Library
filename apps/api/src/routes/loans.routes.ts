import { Router, type Request } from 'express';
import {
  LoanCreateInputSchema,
  LoanListQuerySchema,
  LoanUpdateInputSchema,
} from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../modules/auth/auth.middleware.js';
import {
  borrowResource,
  listAllLoans,
  listMyLoans,
  returnLoan,
} from '../modules/physical-library/physicalLibrary.service.js';

export const loansRouter = Router();

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw AppError.badRequest(`Invalid ${name}`);
  }
  return value;
}

/** Always scoped to `req.authUser` — same "there is no userId in any
 * request here, by construction" guarantee `bookmarks.routes.ts`
 * documents for the identical reason. */
loansRouter.get('/loans', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const query = LoanListQuerySchema.parse(req.query);
  const response = await listMyLoans(req.authUser, query);
  res.status(200).json(response);
});

/** ADMIN-only system-wide listing — registered *before* no conflicting
 * `:id`-shaped route exists for `GET`, but kept as its own fixed path
 * (not `/loans/:id`) so it can never ambiguously match an actual loan
 * id. */
loansRouter.get('/loans/all', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const query = LoanListQuerySchema.parse(req.query);
  const response = await listAllLoans(req.authUser, query);
  res.status(200).json(response);
});

/** `resourceId` only — the server picks which specific copy, see
 * `LoanCreateInputSchema`'s doc comment in packages/contracts. */
loansRouter.post('/loans', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = LoanCreateInputSchema.parse(req.body);
  const loan = await borrowResource(input.resourceId, req.authUser);
  res.status(201).json(loan);
});

/** The entire Loan state machine's one transition — `{status:
 * 'RETURNED'}` is the only body `LoanUpdateInputSchema` accepts. */
loansRouter.patch('/loans/:id', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  LoanUpdateInputSchema.parse(req.body);
  const loan = await returnLoan(requireParam(req, 'id'), req.authUser);
  res.status(200).json(loan);
});
