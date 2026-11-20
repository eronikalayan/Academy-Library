import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import { createTestQueryClient } from '../../../test/renderWithProviders';
import { server } from '../../../test/mswServer';
import { meHandler } from '../../../test/mswHandlers';
import { MOCK_ADMIN_USER, MOCK_STUDENT_USER } from '../../../test/authFixtures';
import { AUTH_ME_QUERY_KEY } from '../../auth/api/useCurrentUser';
import { ApiError } from '../../../shared/api/ApiError';
import { resourceRepository } from '../../../shared/data/resources';
import { useResourceListQuery } from './useResourceListQuery';
import { useResourceDetailQuery } from './useResourceDetailQuery';

function withQueryClient(queryClient = createTestQueryClient()) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

const EMPTY_LIST = { items: [], page: 1, pageSize: 12, totalItems: 0, totalPages: 1 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResourceListQuery — auth-aware caching', () => {
  it('stays disabled until the session check resolves, instead of fetching once as anonymous', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { Wrapper } = withQueryClient();
    const listSpy = vi.spyOn(resourceRepository, 'list').mockResolvedValue(EMPTY_LIST);
    const query = ResourceListQuerySchema.parse({});

    const { result } = renderHook(() => useResourceListQuery(query), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(true);
    expect(listSpy).not.toHaveBeenCalled();

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));
  });

  it('gives two different users two different cache entries, never overwriting one with the other', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { Wrapper, queryClient } = withQueryClient();
    const listSpy = vi.spyOn(resourceRepository, 'list').mockResolvedValue(EMPTY_LIST);
    const query = ResourceListQuerySchema.parse({});

    renderHook(() => useResourceListQuery(query), { wrapper: Wrapper });
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));

    // Mirrors how `useLoginMutation` actually updates identity in this
    // app — a direct write to `AUTH_ME_QUERY_KEY`, not a refetch (see
    // `useCurrentUser.ts`) — i.e. a student logging out and a different
    // admin logging back in within the same browser tab.
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_ADMIN_USER);
    renderHook(() => useResourceListQuery(query), { wrapper: Wrapper });
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));

    const cachedListEntries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['resources', 'list'] });
    expect(cachedListEntries).toHaveLength(2);

    const studentEntry = queryClient
      .getQueryCache()
      .find({ queryKey: ['resources', 'list', MOCK_STUDENT_USER.id, query] });
    const adminEntry = queryClient
      .getQueryCache()
      .find({ queryKey: ['resources', 'list', MOCK_ADMIN_USER.id, query] });
    expect(studentEntry).toBeDefined();
    expect(adminEntry).toBeDefined();
  });

  it('does not retry a deterministic client error (e.g. an invalid query)', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { Wrapper } = withQueryClient();
    const listSpy = vi
      .spyOn(resourceRepository, 'list')
      .mockRejectedValue(
        new ApiError(422, { error: { message: 'Invalid query', code: 'VALIDATION_ERROR' } }),
      );
    const query = ResourceListQuerySchema.parse({});

    const { result } = renderHook(() => useResourceListQuery(query), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure before surfacing it as an error', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { Wrapper } = withQueryClient();
    const listSpy = vi
      .spyOn(resourceRepository, 'list')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(EMPTY_LIST);
    const query = ResourceListQuerySchema.parse({});

    const { result } = renderHook(() => useResourceListQuery(query), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listSpy).toHaveBeenCalledTimes(3);
  });
});

describe('useResourceDetailQuery — auth-aware caching', () => {
  it('keys a resource detail fetch by the current user, so a restricted result never leaks to the next identity', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { Wrapper, queryClient } = withQueryClient();
    const getByIdSpy = vi.spyOn(resourceRepository, 'getById').mockResolvedValue(null);

    renderHook(() => useResourceDetailQuery('res-040'), { wrapper: Wrapper });
    await waitFor(() => expect(getByIdSpy).toHaveBeenCalledTimes(1));

    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_ADMIN_USER);
    renderHook(() => useResourceDetailQuery('res-040'), { wrapper: Wrapper });
    await waitFor(() => expect(getByIdSpy).toHaveBeenCalledTimes(2));

    const cachedDetailEntries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['resources', 'detail'] });
    expect(cachedDetailEntries).toHaveLength(2);
  });

  it('never fetches when there is no resourceId', () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { Wrapper } = withQueryClient();
    const getByIdSpy = vi.spyOn(resourceRepository, 'getById');

    const { result } = renderHook(() => useResourceDetailQuery(undefined), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(true);
    expect(getByIdSpy).not.toHaveBeenCalled();
  });
});
