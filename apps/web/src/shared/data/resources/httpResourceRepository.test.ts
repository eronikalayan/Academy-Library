import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import { server } from '../../../test/mswServer';
import { apiError } from '../../../test/mswHandlers';
import { HttpResourceRepository } from './httpResourceRepository';

const EMPTY_LIST_RESPONSE = { items: [], page: 1, pageSize: 12, totalItems: 0, totalPages: 1 };

const repository = new HttpResourceRepository();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HttpResourceRepository.list', () => {
  it('omits every optional filter when unset, sending only sort/page/pageSize', async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get('/api/v1/resources', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(EMPTY_LIST_RESPONSE);
      }),
    );

    await repository.list(ResourceListQuerySchema.parse({}));

    expect(Array.from(capturedUrl!.searchParams.keys()).sort()).toEqual([
      'page',
      'pageSize',
      'sort',
    ]);
    expect(capturedUrl!.searchParams.get('sort')).toBe('newest');
    expect(capturedUrl!.searchParams.get('page')).toBe('1');
    expect(capturedUrl!.searchParams.get('pageSize')).toBe('12');
  });

  it('comma-joins multiple selected tags into a single query param', async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get('/api/v1/resources', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(EMPTY_LIST_RESPONSE);
      }),
    );

    await repository.list(
      ResourceListQuerySchema.parse({ tags: ['algorithms', 'data-structures'] }),
    );

    expect(capturedUrl!.searchParams.get('tags')).toBe('algorithms,data-structures');
  });

  it('sends the visibility filter — missing from the adapter before Task 05C.2', async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get('/api/v1/resources', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(EMPTY_LIST_RESPONSE);
      }),
    );

    await repository.list(ResourceListQuerySchema.parse({ visibility: 'PUBLIC' }));

    expect(capturedUrl!.searchParams.get('visibility')).toBe('PUBLIC');
  });

  it('rejects when the backend response does not match the shared contract', async () => {
    server.use(http.get('/api/v1/resources', () => HttpResponse.json({ items: 'not-an-array' })));

    await expect(repository.list(ResourceListQuerySchema.parse({}))).rejects.toThrow();
  });
});

describe('HttpResourceRepository.getById', () => {
  it('returns null for a 404 — the same response for a nonexistent id and an inaccessible restricted one', async () => {
    server.use(
      http.get('/api/v1/resources/:id', () =>
        apiError(404, { error: { message: 'Resource not found', code: 'NOT_FOUND' } }),
      ),
    );

    await expect(repository.getById('does-not-exist')).resolves.toBeNull();
  });

  it('rethrows a non-404 failure rather than treating it as "not found"', async () => {
    server.use(
      http.get('/api/v1/resources/:id', () =>
        apiError(500, { error: { message: 'Internal error', code: 'INTERNAL_SERVER_ERROR' } }),
      ),
    );

    await expect(repository.getById('res-001')).rejects.toMatchObject({ status: 500 });
  });
});

describe('AbortSignal propagation', () => {
  it('threads the given signal through to the underlying fetch call', async () => {
    // Spies directly on `fetch` rather than going through MSW — Node
    // 24+'s native fetch rejects a signal from jsdom's `AbortController`
    // polyfill (see `test/setup.ts` for the full explanation and the
    // MSW-layer workaround this app's other tests rely on instead); a
    // mocked `fetch` has no such validation, so this is the one place
    // that can assert the signal *reaches `fetch` at all*, which is what
    // this test cares about — not that a real browser's network stack
    // honors it, which Task 05C.2's browser verification covers instead.
    const controller = new AbortController();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(EMPTY_LIST_RESPONSE), { status: 200 }));

    await repository.list(ResourceListQuerySchema.parse({}), controller.signal);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/resources?'),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
