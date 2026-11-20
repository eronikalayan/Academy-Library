import type {
  BookmarkCreateInput,
  BookmarkListQuery,
  BookmarkListResponse,
  BookmarkStatus,
} from '@academy-library/contracts';

/** The frontend's boundary onto the Bookmarks domain — deliberately
 * small: no `update`, no `getById`, because a bookmark has no fields of
 * its own to edit and no identity worth fetching one at a time — it
 * only ever exists as a member of "the current user's saved list."
 * `status` (Task 07) is the one exception worth a dedicated method: a
 * single resource's saved/unsaved state, answered without paging
 * through `list` at all — see `useIsResourceSaved`. */
export interface BookmarkRepository {
  list(query: BookmarkListQuery, signal?: AbortSignal): Promise<BookmarkListResponse>;
  status(resourceId: string, signal?: AbortSignal): Promise<BookmarkStatus>;
  save(input: BookmarkCreateInput, signal?: AbortSignal): Promise<void>;
  unsave(resourceId: string, signal?: AbortSignal): Promise<void>;
}
