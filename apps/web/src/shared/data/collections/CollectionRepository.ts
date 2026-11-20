import type {
  CollectionCreateInput,
  CollectionDetail,
  CollectionListQuery,
  CollectionResourceOrderInput,
  CollectionSummaryListResponse,
  CollectionUpdateInput,
} from '@academy-library/contracts';

/**
 * The frontend's boundary onto the Collections domain — same shape and
 * reasoning as `shared/data/resources/ResourceRepository.ts`: `signal`
 * is optional on every method, threaded from TanStack Query's
 * `queryFn`/`mutationFn` context.
 *
 * `addResource`/`removeResource`/`reorderResources` all return the
 * collection's full new `CollectionDetail` (the real `/api/v1/collections`
 * endpoints behind them do too — see `collection.service.ts`'s own doc
 * comments) specifically so a caller never needs a second request just
 * to refresh what it's already displaying after a membership/order
 * change.
 */
export interface CollectionRepository {
  list(query: CollectionListQuery, signal?: AbortSignal): Promise<CollectionSummaryListResponse>;
  getById(id: string, signal?: AbortSignal): Promise<CollectionDetail | null>;
  create(input: CollectionCreateInput, signal?: AbortSignal): Promise<CollectionDetail>;
  update(id: string, input: CollectionUpdateInput, signal?: AbortSignal): Promise<CollectionDetail>;
  delete(id: string, signal?: AbortSignal): Promise<void>;
  addResource(id: string, resourceId: string, signal?: AbortSignal): Promise<CollectionDetail>;
  removeResource(id: string, resourceId: string, signal?: AbortSignal): Promise<CollectionDetail>;
  reorderResources(
    id: string,
    input: CollectionResourceOrderInput,
    signal?: AbortSignal,
  ): Promise<CollectionDetail>;
}
