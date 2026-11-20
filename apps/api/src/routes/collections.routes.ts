import { Router, type Request } from 'express';
import {
  CollectionCreateInputSchema,
  CollectionListQuerySchema,
  CollectionResourceAddInputSchema,
  CollectionResourceOrderInputSchema,
  CollectionUpdateInputSchema,
} from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../modules/auth/auth.middleware.js';
import {
  addResourceToCollection,
  createCollection,
  deleteCollection,
  getCollectionById,
  listCollections,
  removeResourceFromCollection,
  reorderCollectionResourceItems,
  updateCollection,
} from '../modules/collections/collection.service.js';
import { buildActorContext } from '../modules/resources/resource.service.js';

export const collectionsRouter = Router();

/** See `resources.routes.ts`'s identical helper — Express 5 types a
 * route param as `string | string[]`, never true for this router's
 * fixed segments, but narrowed explicitly rather than asserted away. */
function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw AppError.badRequest(`Invalid ${name}`);
  }
  return value;
}

/**
 * Every route here requires authentication, including the list/detail
 * reads — deliberately *not* `optionalAuth()` the way the Resource
 * domain's reads are. A `PUBLIC` collection is readable by any signed-in
 * user, but not by an anonymous visitor; see
 * `collection.policy.ts`'s `isCollectionVisibleTo` doc comment and
 * docs/domain/collections.md for why this is an intentional difference
 * from Resources, not an oversight.
 */
collectionsRouter.get('/collections', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const query = CollectionListQuerySchema.parse(req.query);
  const actor = await buildActorContext(req.authUser);
  const response = await listCollections(query, actor);
  res.status(200).json(response);
});

collectionsRouter.get('/collections/:id', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const actor = await buildActorContext(req.authUser);
  const collection = await getCollectionById(requireParam(req, 'id'), actor);
  res.status(200).json(collection);
});

collectionsRouter.post('/collections', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = CollectionCreateInputSchema.parse(req.body);
  const collection = await createCollection(input, req.authUser);
  res.status(201).json(collection);
});

collectionsRouter.patch('/collections/:id', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = CollectionUpdateInputSchema.parse(req.body);
  const collection = await updateCollection(requireParam(req, 'id'), input, req.authUser);
  res.status(200).json(collection);
});

collectionsRouter.delete('/collections/:id', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  await deleteCollection(requireParam(req, 'id'), req.authUser);
  res.status(204).send();
});

/**
 * Idempotent "ensure this resource is a member" — `200` whether the
 * resource was newly added or already present (see
 * `collection.service.ts`'s `addResourceToCollection` doc comment for
 * why this is the documented duplicate-handling policy, not a `409`).
 */
collectionsRouter.post('/collections/:id/resources', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = CollectionResourceAddInputSchema.parse(req.body);
  const collection = await addResourceToCollection(
    requireParam(req, 'id'),
    input.resourceId,
    req.authUser,
  );
  res.status(200).json(collection);
});

/** Returns the collection's new state (`200`), not `204` — mirrors the
 * add endpoint above, so the frontend never needs a second request
 * just to refresh its own view of the same collection it just
 * modified. */
collectionsRouter.delete(
  '/collections/:id/resources/:resourceId',
  requireAuth(),
  async (req, res, next) => {
    if (!req.authUser) {
      next(AppError.unauthorized());
      return;
    }
    const collection = await removeResourceFromCollection(
      requireParam(req, 'id'),
      requireParam(req, 'resourceId'),
      req.authUser,
    );
    res.status(200).json(collection);
  },
);

/**
 * Registered *before* `/collections/:id/resources` would otherwise
 * ambiguously match — it doesn't here (different HTTP method and a
 * fixed trailing `/order` segment, not a `:resourceId` param), but
 * kept as its own explicit route for clarity rather than folded into
 * the add/remove handlers above.
 */
collectionsRouter.patch(
  '/collections/:id/resources/order',
  requireAuth(),
  async (req, res, next) => {
    if (!req.authUser) {
      next(AppError.unauthorized());
      return;
    }
    const input = CollectionResourceOrderInputSchema.parse(req.body);
    const collection = await reorderCollectionResourceItems(
      requireParam(req, 'id'),
      input,
      req.authUser,
    );
    res.status(200).json(collection);
  },
);
