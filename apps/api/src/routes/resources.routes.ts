import { Router, type Request } from 'express';
import {
  ResourceCreateInputSchema,
  ResourceListQuerySchema,
  ResourceUpdateInputSchema,
} from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { optionalAuth, requireAuth } from '../modules/auth/auth.middleware.js';
import {
  buildActorContext,
  createResource,
  deleteResource,
  getResourceById,
  listResources,
  updateResource,
} from '../modules/resources/resource.service.js';

export const resourcesRouter = Router();

/** Express 5 types `req.params[name]` as `string | string[]` (a route can
 * have a repeated `*`/array segment) — never true for this router's
 * fixed `:id` segment, but TypeScript has no way to know that from the
 * route path string alone, so it is narrowed explicitly rather than
 * asserted away. */
function requireIdParam(req: Request): string {
  const { id } = req.params;
  if (typeof id !== 'string') {
    throw AppError.badRequest('Invalid resource id');
  }
  return id;
}

/**
 * `tags` arrives as a single comma-separated query parameter (matching
 * `HttpResourceRepository.list` in apps/web and the "Planned REST
 * contract" in docs/domain/resources.md), not Express's default repeated-
 * key array style (`tags=a&tags=b`) — so it is split here, at the HTTP
 * boundary, before `ResourceListQuerySchema` (which expects an actual
 * array) ever sees it. Everything else in `req.query` passes through
 * unchanged for the schema's own `.coerce`/defaults to handle.
 */
resourcesRouter.get('/resources', optionalAuth(), async (req, res) => {
  const rawTags = req.query.tags;
  const query = ResourceListQuerySchema.parse({
    ...req.query,
    tags: typeof rawTags === 'string' ? rawTags.split(',').filter(Boolean) : undefined,
  });

  const actor = await buildActorContext(req.authUser);
  const response = await listResources(query, actor);
  res.status(200).json(response);
});

/**
 * Open to anonymous requests (`optionalAuth`, not `requireAuth`) — a
 * `PUBLIC` resource is viewable without logging in, per the documented
 * guest-access policy. `getResourceById` itself throws `notFound` for a
 * resource that either does not exist or is not visible to this actor —
 * the same response either way, so a `RESTRICTED` resource's existence
 * is never confirmed to someone who cannot see it.
 */
resourcesRouter.get('/resources/:id', optionalAuth(), async (req, res) => {
  const actor = await buildActorContext(req.authUser);
  const resource = await getResourceById(requireIdParam(req), actor);
  res.status(200).json(resource);
});

resourcesRouter.post('/resources', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = ResourceCreateInputSchema.parse(req.body);
  const resource = await createResource(input, req.authUser);
  res.status(201).json(resource);
});

resourcesRouter.patch('/resources/:id', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = ResourceUpdateInputSchema.parse(req.body);
  const resource = await updateResource(requireIdParam(req), input, req.authUser);
  res.status(200).json(resource);
});

resourcesRouter.delete('/resources/:id', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  await deleteResource(requireIdParam(req), req.authUser);
  res.status(204).send();
});
