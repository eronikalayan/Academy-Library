import {
  ResourceCreateInputSchema,
  ResourceDetailSchema,
  ResourceSummaryListResponseSchema,
  ResourceUpdateInputSchema,
} from '@academy-library/contracts';
import type {
  ResourceCreateInput,
  ResourceDetail,
  ResourceListQuery,
  ResourceSummaryListResponse,
  ResourceUpdateInput,
} from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import { ApiError } from '../../api/ApiError';
import type { ResourceRepository } from './ResourceRepository';

function buildListQueryString(query: ResourceListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.type) params.set('type', query.type);
  if (query.difficulty) params.set('difficulty', query.difficulty);
  if (query.courseId) params.set('courseId', query.courseId);
  if (query.tags && query.tags.length > 0) params.set('tags', query.tags.join(','));
  if (query.visibility) params.set('visibility', query.visibility);
  params.set('sort', query.sort);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

/**
 * The active production implementation as of Task 05C.2 — wired in via
 * `shared/data/resources/index.ts`. Goes through the same shared
 * `apiRequest` (`shared/api/httpClient.ts`) every other API call in this
 * app uses, rather than calling `fetch` directly: same-origin
 * credentials, correct CSRF handling for non-GET methods (moot for these
 * two read-only endpoints, but the one HTTP boundary stays one boundary),
 * and responses parsed through the real contract schemas rather than
 * trusted structurally. See docs/domain/resources.md ("How the HTTP
 * adapter replaces the mock") for the endpoints this assumes.
 */
export class HttpResourceRepository implements ResourceRepository {
  async list(query: ResourceListQuery, signal?: AbortSignal): Promise<ResourceSummaryListResponse> {
    return apiRequest(
      `/resources?${buildListQueryString(query)}`,
      (data) => ResourceSummaryListResponseSchema.parse(data),
      { signal },
    );
  }

  /**
   * The backend returns `404` for both "no such resource" and "exists
   * but not visible to this caller" — deliberately the same response
   * either way, so a restricted resource's existence is never confirmed
   * to someone who cannot see it (see docs/domain/resources.md,
   * "Authorization rules"). This method preserves that: `null` either
   * way, never a distinguishable error. Any other failure (a genuine
   * `400`/`500`/network error) still throws, so `ResourceDetailsPage`'s
   * error state isn't silently swallowed into "not found."
   */
  async getById(id: string, signal?: AbortSignal): Promise<ResourceDetail | null> {
    try {
      return await apiRequest(
        `/resources/${encodeURIComponent(id)}`,
        (data) => ResourceDetailSchema.parse(data),
        { signal },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Validated against the same request-shape schema the backend expects
  // before ever leaving the browser (matching `features/auth/api/authApi.ts`'s
  // `login`/`register`) — a malformed payload fails fast, client-side,
  // rather than round-tripping to the server only to get the identical
  // 400 back.
  async create(input: ResourceCreateInput, signal?: AbortSignal): Promise<ResourceDetail> {
    const body = ResourceCreateInputSchema.parse(input);
    return apiRequest('/resources', (data) => ResourceDetailSchema.parse(data), {
      method: 'POST',
      body,
      signal,
    });
  }

  async update(
    id: string,
    input: ResourceUpdateInput,
    signal?: AbortSignal,
  ): Promise<ResourceDetail> {
    const body = ResourceUpdateInputSchema.parse(input);
    return apiRequest(
      `/resources/${encodeURIComponent(id)}`,
      (data) => ResourceDetailSchema.parse(data),
      {
        method: 'PATCH',
        body,
        signal,
      },
    );
  }

  delete(id: string, signal?: AbortSignal): Promise<void> {
    return apiRequest(`/resources/${encodeURIComponent(id)}`, () => undefined, {
      method: 'DELETE',
      signal,
    });
  }
}
