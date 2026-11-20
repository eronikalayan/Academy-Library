import {
  CollectionCreateInputSchema,
  CollectionDetailSchema,
  CollectionResourceAddInputSchema,
  CollectionResourceOrderInputSchema,
  CollectionSummaryListResponseSchema,
  CollectionUpdateInputSchema,
} from '@academy-library/contracts';
import type {
  CollectionCreateInput,
  CollectionDetail,
  CollectionListQuery,
  CollectionResourceOrderInput,
  CollectionSummaryListResponse,
  CollectionUpdateInput,
} from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import { ApiError } from '../../api/ApiError';
import type { CollectionRepository } from './CollectionRepository';

function buildListQueryString(query: CollectionListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.visibility) params.set('visibility', query.visibility);
  params.set('sort', query.sort);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

/** The active implementation, matching `HttpResourceRepository`'s own
 * conventions exactly: same shared `apiRequest`, same "404 means null,
 * not a distinguishable error" treatment on `getById` (the backend
 * returns `404` for both "no such collection" and "exists but not
 * visible to this caller" — see `collection.policy.ts`). */
export class HttpCollectionRepository implements CollectionRepository {
  async list(
    query: CollectionListQuery,
    signal?: AbortSignal,
  ): Promise<CollectionSummaryListResponse> {
    return apiRequest(
      `/collections?${buildListQueryString(query)}`,
      (data) => CollectionSummaryListResponseSchema.parse(data),
      { signal },
    );
  }

  async getById(id: string, signal?: AbortSignal): Promise<CollectionDetail | null> {
    try {
      return await apiRequest(
        `/collections/${encodeURIComponent(id)}`,
        (data) => CollectionDetailSchema.parse(data),
        { signal },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async create(input: CollectionCreateInput, signal?: AbortSignal): Promise<CollectionDetail> {
    const body = CollectionCreateInputSchema.parse(input);
    return apiRequest('/collections', (data) => CollectionDetailSchema.parse(data), {
      method: 'POST',
      body,
      signal,
    });
  }

  async update(
    id: string,
    input: CollectionUpdateInput,
    signal?: AbortSignal,
  ): Promise<CollectionDetail> {
    const body = CollectionUpdateInputSchema.parse(input);
    return apiRequest(
      `/collections/${encodeURIComponent(id)}`,
      (data) => CollectionDetailSchema.parse(data),
      { method: 'PATCH', body, signal },
    );
  }

  delete(id: string, signal?: AbortSignal): Promise<void> {
    return apiRequest(`/collections/${encodeURIComponent(id)}`, () => undefined, {
      method: 'DELETE',
      signal,
    });
  }

  async addResource(
    id: string,
    resourceId: string,
    signal?: AbortSignal,
  ): Promise<CollectionDetail> {
    const body = CollectionResourceAddInputSchema.parse({ resourceId });
    return apiRequest(
      `/collections/${encodeURIComponent(id)}/resources`,
      (data) => CollectionDetailSchema.parse(data),
      { method: 'POST', body, signal },
    );
  }

  async removeResource(
    id: string,
    resourceId: string,
    signal?: AbortSignal,
  ): Promise<CollectionDetail> {
    return apiRequest(
      `/collections/${encodeURIComponent(id)}/resources/${encodeURIComponent(resourceId)}`,
      (data) => CollectionDetailSchema.parse(data),
      { method: 'DELETE', signal },
    );
  }

  async reorderResources(
    id: string,
    input: CollectionResourceOrderInput,
    signal?: AbortSignal,
  ): Promise<CollectionDetail> {
    const body = CollectionResourceOrderInputSchema.parse(input);
    return apiRequest(
      `/collections/${encodeURIComponent(id)}/resources/order`,
      (data) => CollectionDetailSchema.parse(data),
      { method: 'PATCH', body, signal },
    );
  }
}
