import { Router } from 'express';
import { BookmarkCreateInputSchema, BookmarkListQuerySchema } from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../modules/auth/auth.middleware.js';
import {
  getBookmarkStatus,
  listBookmarks,
  saveResource,
  unsaveResource,
} from '../modules/bookmarks/bookmark.service.js';

export const bookmarksRouter = Router();

/**
 * Always scoped to `req.authUser` — there is no `userId` in any request
 * body or query here, by construction, which is the entire access-
 * control story for "a user can never read or modify another user's
 * bookmarks": the question literally cannot be asked.
 */
bookmarksRouter.get('/bookmarks', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const query = BookmarkListQuerySchema.parse(req.query);
  const response = await listBookmarks(req.authUser, query);
  res.status(200).json(response);
});

bookmarksRouter.post('/bookmarks', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const input = BookmarkCreateInputSchema.parse(req.body);
  await saveResource(input, req.authUser);
  res.status(204).send();
});

bookmarksRouter.delete('/bookmarks/:resourceId', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const { resourceId } = req.params;
  if (typeof resourceId !== 'string') {
    next(AppError.badRequest('Invalid resourceId'));
    return;
  }
  await unsaveResource(resourceId, req.authUser);
  res.status(204).send();
});

/** Task 07 — a dedicated, O(1) per-resource check, replacing the
 * frontend's earlier reliance on a capped page of the list above (see
 * `bookmark.service.ts`'s `getBookmarkStatus` doc comment). */
bookmarksRouter.get('/bookmarks/:resourceId/status', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const { resourceId } = req.params;
  if (typeof resourceId !== 'string') {
    next(AppError.badRequest('Invalid resourceId'));
    return;
  }
  const status = await getBookmarkStatus(resourceId, req.authUser);
  res.status(200).json(status);
});
