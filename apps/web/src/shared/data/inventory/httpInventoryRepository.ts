import {
  BookCopyCreateInputSchema,
  BookCopyListResponseSchema,
  BookCopySchema,
  BookCopyUpdateInputSchema,
} from '@academy-library/contracts';
import type { BookCopy, BookCopyListResponse } from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import type { InventoryRepository } from './InventoryRepository';

export class HttpInventoryRepository implements InventoryRepository {
  async listCopies(resourceId: string, signal?: AbortSignal): Promise<BookCopyListResponse> {
    return apiRequest(
      `/resources/${encodeURIComponent(resourceId)}/copies`,
      (data) => BookCopyListResponseSchema.parse(data),
      { signal },
    );
  }

  async registerCopy(
    resourceId: string,
    inventoryCode: string,
    signal?: AbortSignal,
  ): Promise<BookCopy> {
    const body = BookCopyCreateInputSchema.parse({ inventoryCode });
    return apiRequest(
      `/resources/${encodeURIComponent(resourceId)}/copies`,
      (data) => BookCopySchema.parse(data),
      { method: 'POST', body, signal },
    );
  }

  async archiveCopy(resourceId: string, copyId: string, signal?: AbortSignal): Promise<BookCopy> {
    const body = BookCopyUpdateInputSchema.parse({ status: 'ARCHIVED' });
    return apiRequest(
      `/resources/${encodeURIComponent(resourceId)}/copies/${encodeURIComponent(copyId)}`,
      (data) => BookCopySchema.parse(data),
      { method: 'PATCH', body, signal },
    );
  }
}
