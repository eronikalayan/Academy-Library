import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../../test/renderWithProviders';
import { resourceRepository } from '../../../shared/data/resources';
import { useCreateResourceMutation } from './useCreateResourceMutation';
import { useUpdateResourceMutation } from './useUpdateResourceMutation';
import { useDeleteResourceMutation } from './useDeleteResourceMutation';

function withQueryClient(queryClient = createTestQueryClient()) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

const MINIMAL_DETAIL = {
  id: 'res-1',
  type: 'ARTICLE' as const,
  title: 'A resource',
  description: 'Something.',
  difficulty: 'BEGINNER' as const,
  creator: { name: 'Jane' },
  coverImageUrl: null,
  sourceUrl: null,
  tags: [],
  courses: [],
  publishedAt: null,
  publisher: null,
  visibility: 'PUBLIC' as const,
  restrictedToGroupIds: [],
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  capabilities: { canEdit: true, canDelete: true },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resource mutation cache invalidation', () => {
  it('useCreateResourceMutation invalidates every cached resources query on success', async () => {
    const { Wrapper, queryClient } = withQueryClient();
    queryClient.setQueryData(['resources', 'list', 'user-1', { page: 1 }], { items: [] });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.spyOn(resourceRepository, 'create').mockResolvedValue(MINIMAL_DETAIL);

    const { result } = renderHook(() => useCreateResourceMutation(), { wrapper: Wrapper });
    result.current.mutate({
      type: 'ARTICLE',
      title: 'A resource',
      description: 'Something.',
      difficulty: 'BEGINNER',
      creator: { name: 'Jane' },
      courseIds: [],
      tags: [],
      visibility: 'PUBLIC',
      restrictedToGroupIds: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['resources'] });
  });

  it('useUpdateResourceMutation invalidates every cached resources query on success', async () => {
    const { Wrapper, queryClient } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.spyOn(resourceRepository, 'update').mockResolvedValue(MINIMAL_DETAIL);

    const { result } = renderHook(() => useUpdateResourceMutation(), { wrapper: Wrapper });
    result.current.mutate({ id: 'res-1', input: { title: 'Updated' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['resources'] });
  });

  it('useDeleteResourceMutation invalidates every cached resources query on success, never before', async () => {
    const { Wrapper, queryClient } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let resolveDelete!: () => void;
    vi.spyOn(resourceRepository, 'delete').mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }),
    );

    const { result } = renderHook(() => useDeleteResourceMutation(), { wrapper: Wrapper });
    result.current.mutate('res-1');

    await waitFor(() => expect(result.current.isPending).toBe(true));
    // No optimistic invalidation/removal while the delete is still in
    // flight — only after the server actually confirms it.
    expect(invalidateSpy).not.toHaveBeenCalled();

    resolveDelete();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['resources'] });
  });

  it('does not invalidate anything when the delete request fails', async () => {
    const { Wrapper, queryClient } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.spyOn(resourceRepository, 'delete').mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDeleteResourceMutation(), { wrapper: Wrapper });
    result.current.mutate('res-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
