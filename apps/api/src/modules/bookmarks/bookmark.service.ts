import type {
  BookmarkCreateInput,
  BookmarkListQuery,
  BookmarkListResponse,
  BookmarkStatus,
  PublicUser,
} from '@academy-library/contracts';
import { AppError } from '../../errors/AppError.js';
import { toResourceSummary } from '../resources/resource.mapper.js';
import { isResourceVisibleTo } from '../resources/resource.policy.js';
import { findResourceById } from '../resources/resource.repository.js';
import { buildActorContext } from '../resources/resource.service.js';
import {
  createBookmark as createBookmarkRow,
  deleteBookmark as deleteBookmarkRow,
  findVisibleSavedResourcePage,
  isResourceSavedByUser,
} from './bookmark.repository.js';

/**
 * Database-level filtered, paginated listing (Task 07) — see
 * `bookmark.repository.ts`'s `findVisibleSavedResourcePage` doc comment
 * for why this replaced Task 06's fetch-all-then-filter-in-memory
 * approach. A bookmark row for a resource the saver can no longer
 * independently see (visibility changed, group membership lost) is
 * excluded by the same SQL-level visibility condition every other read
 * path applies — left in the database (so it reappears if access is
 * restored) but never counted in `totalItems` or returned here.
 */
export async function listBookmarks(
  user: PublicUser,
  query: BookmarkListQuery,
): Promise<BookmarkListResponse> {
  const actor = await buildActorContext(user);
  const { entries, totalItems } = await findVisibleSavedResourcePage(user.id, actor, {
    page: query.page,
    pageSize: query.pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: entries.map((entry) => ({
      resource: toResourceSummary(entry.resource),
      createdAt: entry.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
  };
}

/** The resource must be visible to the saver *independently* — same
 * reasoning as `collection.service.ts`'s `addResourceToCollection`:
 * otherwise this endpoint would be a way to probe a restricted
 * resource's existence without ever having real access to it. */
export async function saveResource(input: BookmarkCreateInput, user: PublicUser): Promise<void> {
  const actor = await buildActorContext(user);
  const resource = await findResourceById(input.resourceId);
  if (!resource || !isResourceVisibleTo(resource, actor)) {
    throw AppError.badRequest('Resource does not exist or is not accessible', {
      invalidResourceIds: [input.resourceId],
    });
  }
  await createBookmarkRow(user.id, input.resourceId);
}

/** No visibility check on the way out — a user must always be able to
 * remove their own bookmark, even one whose resource has since become
 * inaccessible to them; re-checking visibility here would make an
 * already-hidden bookmark impossible to clean up. */
export async function unsaveResource(resourceId: string, user: PublicUser): Promise<void> {
  await deleteBookmarkRow(user.id, resourceId);
}

/**
 * Answers "have I saved this one resource" in O(1), independent of how
 * many resources this user has saved in total — the fix for
 * `useIsResourceSaved` previously deriving this from a capped page of
 * `GET /bookmarks` (Task 06's `SAVED_RESOURCES_PAGE_SIZE`), which was
 * silently wrong for a user's 61st-and-beyond saved resource.
 */
export async function getBookmarkStatus(
  resourceId: string,
  user: PublicUser,
): Promise<BookmarkStatus> {
  const isSaved = await isResourceSavedByUser(user.id, resourceId);
  return { resourceId, isSaved };
}
