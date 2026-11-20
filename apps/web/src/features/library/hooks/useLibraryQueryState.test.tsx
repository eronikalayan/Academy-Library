import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useLibraryQueryState } from './useLibraryQueryState';

function wrapper(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
  };
}

describe('useLibraryQueryState', () => {
  it('defaults to page 1, sort newest, view grid, pageSize 12 with an empty URL', () => {
    const { result } = renderHook(() => useLibraryQueryState(), { wrapper: wrapper('/library') });

    expect(result.current.query).toEqual({ sort: 'newest', page: 1, pageSize: 12 });
    expect(result.current.view).toBe('grid');
  });

  it('parses search/type/difficulty/courseId/tags/sort/page from the URL', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper(
        '/library?search=postgres&type=ARTICLE&difficulty=INTERMEDIATE&courseId=db301&tags=sql,databases&sort=title_asc&page=2',
      ),
    });

    expect(result.current.query).toEqual({
      search: 'postgres',
      type: 'ARTICLE',
      difficulty: 'INTERMEDIATE',
      courseId: 'db301',
      tags: ['sql', 'databases'],
      sort: 'title_asc',
      page: 2,
      pageSize: 12,
    });
  });

  it('falls back to defaults for an invalid/tampered query string instead of throwing', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?sort=bogus&page=not-a-number'),
    });

    expect(result.current.query.sort).toBe('newest');
    expect(result.current.query.page).toBe(1);
  });

  it('reads view=list from the URL', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?view=list'),
    });

    expect(result.current.view).toBe('list');
  });

  it('setSearch updates the search term and resets the page', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?page=3'),
    });

    act(() => result.current.setSearch('algorithms'));

    expect(result.current.query.search).toBe('algorithms');
    expect(result.current.query.page).toBe(1);
  });

  it('clearing the search term while sorted by relevance falls back to newest', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?search=sql&sort=relevance'),
    });

    act(() => result.current.setSearch(''));

    expect(result.current.query.sort).toBe('newest');
  });

  it('setFilters applies type/difficulty/courseId/tags and resets the page', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?page=2'),
    });

    act(() =>
      result.current.setFilters({ type: 'BOOK', difficulty: 'BEGINNER', tags: ['algorithms'] }),
    );

    expect(result.current.query.type).toBe('BOOK');
    expect(result.current.query.difficulty).toBe('BEGINNER');
    expect(result.current.query.tags).toEqual(['algorithms']);
    expect(result.current.query.page).toBe(1);
  });

  it('clearFilters removes type/difficulty/courseId/tags but keeps the search term', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?search=sql&type=BOOK&difficulty=BEGINNER&tags=algorithms'),
    });

    act(() => result.current.clearFilters());

    expect(result.current.query).toEqual({ search: 'sql', sort: 'newest', page: 1, pageSize: 12 });
  });

  it('resetAll clears the search term and every filter in one atomic update', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?search=sql&type=BOOK&difficulty=BEGINNER&tags=algorithms&page=3'),
    });

    act(() => result.current.resetAll());

    expect(result.current.query).toEqual({ sort: 'newest', page: 1, pageSize: 12 });
  });

  it('setSearch followed by clearFilters in the same handler would lose the search clear — resetAll does not', () => {
    // Regression guard: this is exactly the bug resetAll was added to fix
    // (two independent setSearchParams calls in one handler can clobber
    // each other's update since each reads "previous" independently).
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?search=sql&type=BOOK'),
    });

    act(() => {
      result.current.setSearch('');
      result.current.clearFilters();
    });
    // Document the known-bad pattern's actual behavior, rather than just
    // asserting resetAll works in isolation.
    expect(result.current.query.search).toBe('sql');

    act(() => result.current.resetAll());
    expect(result.current.query.search).toBeUndefined();
  });

  it('setPage updates the page without touching other params', () => {
    const { result } = renderHook(() => useLibraryQueryState(), {
      wrapper: wrapper('/library?search=sql'),
    });

    act(() => result.current.setPage(3));

    expect(result.current.query.page).toBe(3);
    expect(result.current.query.search).toBe('sql');
  });

  it('setView toggles between grid and list', () => {
    const { result } = renderHook(() => useLibraryQueryState(), { wrapper: wrapper('/library') });

    act(() => result.current.setView('list'));
    expect(result.current.view).toBe('list');

    act(() => result.current.setView('grid'));
    expect(result.current.view).toBe('grid');
  });
});
