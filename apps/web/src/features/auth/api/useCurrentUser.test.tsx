import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../../test/renderWithProviders';
import { server } from '../../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../../test/authFixtures';
import { apiError, authResponse, meHandler } from '../../../test/mswHandlers';
import { useCurrentUser } from './useCurrentUser';

function withQueryClient() {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('useCurrentUser', () => {
  it('starts loading, then resolves with the user for an active session', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    const { result } = renderHook(() => useCurrentUser(), { wrapper: withQueryClient() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(MOCK_STUDENT_USER);
    expect(result.current.isError).toBe(false);
  });

  it('resolves with data: null for an anonymous/expired session, not an error state', async () => {
    server.use(meHandler(null));
    const { result } = renderHook(() => useCurrentUser(), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('retries a transient server failure before giving up, rather than treating it as logged out (Task 05C.2)', async () => {
    let attempt = 0;
    server.use(
      http.get('/api/v1/auth/me', () => {
        attempt += 1;
        return attempt <= 2
          ? apiError(500, { error: { message: 'Internal error', code: 'INTERNAL_SERVER_ERROR' } })
          : HttpResponse.json(authResponse(MOCK_STUDENT_USER));
      }),
    );

    const { result } = renderHook(() => useCurrentUser(), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_STUDENT_USER);
    expect(attempt).toBe(3);
  });
});
