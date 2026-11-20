import type {
  ResourceCreateInput,
  ResourceDetail,
  ResourceListQuery,
  ResourceSummaryListResponse,
  ResourceUpdateInput,
} from '@academy-library/contracts';

/**
 * The frontend's boundary onto the Resource domain. `httpResourceRepository`
 * is the active implementation (wired in Task 05C.2 for reads, extended in
 * Task 05C.3 for writes); `mockResourceRepository` remains available for
 * isolated tests and dev scenarios where a running backend isn't wanted —
 * both satisfy this same interface, so swapping between them is a one-line
 * change (see `shared/data/resources/index.ts`).
 *
 * `signal` is optional on every method — threaded from TanStack Query's
 * `queryFn`/`mutationFn` context so an in-flight request can be aborted
 * (component unmount, or a newer request superseding this one, e.g. fast
 * pagination/filter changes). `MockResourceRepository` accepts it for
 * interface parity but has nothing to abort (its "request" is synchronous,
 * in-memory work).
 *
 * `create`/`update` return the full `ResourceDetail` the backend just
 * persisted (including freshly-computed `capabilities` for the caller who
 * just created/edited it) — callers never need a separate read-back.
 * `delete` returns nothing (the backend responds `204`); the caller's own
 * mutation hook decides what to do with the now-gone resource (navigate
 * away, invalidate caches), not this boundary.
 */
export interface ResourceRepository {
  list(query: ResourceListQuery, signal?: AbortSignal): Promise<ResourceSummaryListResponse>;
  getById(id: string, signal?: AbortSignal): Promise<ResourceDetail | null>;
  create(input: ResourceCreateInput, signal?: AbortSignal): Promise<ResourceDetail>;
  update(id: string, input: ResourceUpdateInput, signal?: AbortSignal): Promise<ResourceDetail>;
  delete(id: string, signal?: AbortSignal): Promise<void>;
}
