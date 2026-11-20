import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../../test/renderWithProviders';
import { server } from '../../../test/mswServer';
import { MOCK_ADMIN_USER, MOCK_STUDENT_USER } from '../../../test/authFixtures';
import { csrfTokenHandler, logoutHandler, meHandler } from '../../../test/mswHandlers';
import { AUTH_ME_QUERY_KEY } from './useCurrentUser';
import { useLogoutMutation } from './useLogoutMutation';

function withQueryClient() {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

/**
 * Task 05D — verifying the "student logout, then admin login in the
 * same browser context" scenario the task brief calls out explicitly.
 * `useResourceListQuery`/`useResourceDetailQuery` already key every
 * entry by identity (see `resourceQueryAuth.test.tsx`), so a *different*
 * user never overwrites a *different* cache entry — but that alone
 * doesn't prove the *previous* user's entries are gone, only that they
 * wouldn't collide. These tests exercise the real `useLogoutMutation`
 * hook directly (not a raw `setQueryData` identity swap) to confirm the
 * actual mechanism — `queryClient.clear()` — removes every prior
 * entry outright.
 */
describe('useLogoutMutation', () => {
  it('clears every cached query on logout, not just auth/me', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER), logoutHandler);
    const { Wrapper, queryClient } = withQueryClient();
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_STUDENT_USER);
    queryClient.setQueryData(['resources', 'list', MOCK_STUDENT_USER.id, {}], {
      items: [{ id: 'restricted-1' }],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
    });
    queryClient.setQueryData(['resources', 'detail', MOCK_STUDENT_USER.id, 'restricted-1'], {
      id: 'restricted-1',
      title: 'Restricted to student',
    });

    const { result } = renderHook(() => useLogoutMutation(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(queryClient.getQueryData(AUTH_ME_QUERY_KEY)).toBeNull();
    expect(queryClient.getQueryCache().findAll({ queryKey: ['resources'] })).toHaveLength(0);
  });

  it('leaves no trace of the previous identity once a different user logs in afterward', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER), logoutHandler);
    const { Wrapper, queryClient } = withQueryClient();
    queryClient.setQueryData(['resources', 'detail', MOCK_STUDENT_USER.id, 'restricted-1'], {
      id: 'restricted-1',
      title: 'Restricted to student',
    });

    const { result } = renderHook(() => useLogoutMutation(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    // Mirrors how `useLoginMutation` actually updates identity in this
    // app (see useCurrentUser.ts) — an admin signing in, in the same
    // browser tab/query client, right after the student's logout.
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_ADMIN_USER);

    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ['resources', 'detail', MOCK_STUDENT_USER.id, 'restricted-1'] }),
    ).toBeUndefined();
  });
});
