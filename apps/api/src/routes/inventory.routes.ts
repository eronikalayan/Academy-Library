import { Router, type Request } from 'express';
import { BookCopyCreateInputSchema, BookCopyUpdateInputSchema } from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { optionalAuth, requireAuth } from '../modules/auth/auth.middleware.js';
import {
  archiveCopy,
  listCopiesForResource,
  registerCopy,
} from '../modules/physical-library/physicalLibrary.service.js';
import { buildActorContext } from '../modules/resources/resource.service.js';

export const inventoryRouter = Router();

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw AppError.badRequest(`Invalid ${name}`);
  }
  return value;
}

/**
 * Open to anonymous requests (`optionalAuth`, not `requireAuth`) — a
 * physical copy's visibility tracks its resource's own visibility
 * exactly (see `physicalLibrary.service.ts`'s `listCopiesForResource`),
 * and a `PUBLIC` resource is itself viewable anonymously (see
 * `resources.routes.ts`'s identical reasoning for `GET /resources/:id`).
 * There is no independent "Physical Library requires auth" rule the way
 * Collections has one.
 */
inventoryRouter.get('/resources/:resourceId/copies', optionalAuth(), async (req, res) => {
  const actor = await buildActorContext(req.authUser);
  const response = await listCopiesForResource(requireParam(req, 'resourceId'), actor);
  res.status(200).json(response);
});

inventoryRouter.post('/resources/:resourceId/copies', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = BookCopyCreateInputSchema.parse(req.body);
  const copy = await registerCopy(
    requireParam(req, 'resourceId'),
    input.inventoryCode,
    req.authUser,
  );
  res.status(201).json(copy);
});

inventoryRouter.patch(
  '/resources/:resourceId/copies/:copyId',
  requireAuth(),
  async (req, res, next) => {
    if (!req.authUser) {
      next(AppError.unauthorized());
      return;
    }
    BookCopyUpdateInputSchema.parse(req.body);
    const copy = await archiveCopy(
      requireParam(req, 'resourceId'),
      requireParam(req, 'copyId'),
      req.authUser,
    );
    res.status(200).json(copy);
  },
);
