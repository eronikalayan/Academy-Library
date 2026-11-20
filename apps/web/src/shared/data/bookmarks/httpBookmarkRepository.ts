import {
  BookmarkCreateInputSchema,
  BookmarkListResponseSchema,
  BookmarkStatusSchema,
} from '@academy-library/contracts';
import type {
  BookmarkCreateInput,
  BookmarkListQuery,
  BookmarkListResponse,
  BookmarkStatus,
} from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import type { BookmarkRepository } from './BookmarkRepository';

function buildListQueryString(query: BookmarkListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

export class HttpBookmarkRepository implements BookmarkRepository {
  async list(query: BookmarkListQuery, signal?: AbortSignal): Promise<BookmarkListResponse> {
    return apiRequest(
      `/bookmarks?${buildListQueryString(query)}`,
      (data) => BookmarkListResponseSchema.parse(data),
      { signal },
    );
  }

  async status(resourceId: string, signal?: AbortSignal): Promise<BookmarkStatus> {
    return apiRequest(
      `/bookmarks/${encodeURIComponent(resourceId)}/status`,
      (data) => BookmarkStatusSchema.parse(data),
      { signal },
    );
  }

  save(input: BookmarkCreateInput, signal?: AbortSignal): Promise<void> {
    const body = BookmarkCreateInputSchema.parse(input);
    return apiRequest('/bookmarks', () => undefined, { method: 'POST', body, signal });
  }

  unsave(resourceId: string, signal?: AbortSignal): Promise<void> {
    return apiRequest(`/bookmarks/${encodeURIComponent(resourceId)}`, () => undefined, {
      method: 'DELETE',
      signal,
    });
  }
}
