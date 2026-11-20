import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import type {
  ResourceDifficulty,
  ResourceListQuery,
  ResourceSort,
  ResourceType,
} from '@academy-library/contracts';

export type LibraryViewMode = 'grid' | 'list';

export interface LibraryFilters {
  type?: ResourceType;
  difficulty?: ResourceDifficulty;
  courseId?: string;
  tags?: string[];
}

/** Not exposed in the UI — the Library Explorer doesn't offer a page-size
 * control, so this stays a fixed implementation detail. */
const PAGE_SIZE = 12;

function parseQuery(searchParams: URLSearchParams): ResourceListQuery {
  const raw: Record<string, unknown> = { pageSize: PAGE_SIZE };

  const search = searchParams.get('search');
  if (search) raw.search = search;
  const type = searchParams.get('type');
  if (type) raw.type = type;
  const difficulty = searchParams.get('difficulty');
  if (difficulty) raw.difficulty = difficulty;
  const courseId = searchParams.get('courseId');
  if (courseId) raw.courseId = courseId;
  const tags = searchParams.get('tags');
  if (tags) raw.tags = tags.split(',').filter(Boolean);
  const sort = searchParams.get('sort');
  if (sort) raw.sort = sort;
  const page = searchParams.get('page');
  if (page) raw.page = page;

  const parsed = ResourceListQuerySchema.safeParse(raw);
  // An invalid/tampered URL (e.g. `?sort=bogus`) falls back to defaults
  // rather than crashing the page.
  return parsed.success ? parsed.data : ResourceListQuerySchema.parse({ pageSize: PAGE_SIZE });
}

/**
 * The Library Explorer's single source of truth for search/filter/sort/
 * page/view state — all of it lives in the URL (via `useSearchParams`) so
 * the page is shareable and back/forward-navigable, never in local
 * component state. Default values (page 1, sort "newest", view "grid")
 * are omitted from the URL entirely rather than written explicitly, to
 * keep shared links short.
 */
export function useLibraryQueryState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const view: LibraryViewMode = searchParams.get('view') === 'list' ? 'list' : 'grid';

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set('search', value);
        else next.delete('search');
        // "Relevance" only makes sense with a search term — if one is no
        // longer present, fall back to the default sort rather than
        // leaving the Select pointed at an option it no longer offers.
        if (!value && next.get('sort') === 'relevance') next.delete('sort');
        next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (filters: LibraryFilters) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (filters.type) next.set('type', filters.type);
        else next.delete('type');
        if (filters.difficulty) next.set('difficulty', filters.difficulty);
        else next.delete('difficulty');
        if (filters.courseId) next.set('courseId', filters.courseId);
        else next.delete('courseId');
        if (filters.tags && filters.tags.length > 0) next.set('tags', filters.tags.join(','));
        else next.delete('tags');
        next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('type');
      next.delete('difficulty');
      next.delete('courseId');
      next.delete('tags');
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  // The empty-results state's "clear everything" action needs to clear
  // *both* the search term and the filters in one go. Calling `setSearch`
  // and `clearFilters` back to back would not work: each reads the
  // "previous" params independently via `setSearchParams`'s updater, so
  // the second call doesn't see the first call's not-yet-applied change
  // and can clobber it — a single combined update avoids that entirely.
  const resetAll = useCallback(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('search');
      next.delete('type');
      next.delete('difficulty');
      next.delete('courseId');
      next.delete('tags');
      next.delete('sort');
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const setSort = useCallback(
    (sort: ResourceSort) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (sort === 'newest') next.delete('sort');
        else next.set('sort', sort);
        next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (page: number) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (page <= 1) next.delete('page');
        else next.set('page', String(page));
        return next;
      });
    },
    [setSearchParams],
  );

  const setView = useCallback(
    (nextView: LibraryViewMode) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (nextView === 'grid') next.delete('view');
        else next.set('view', nextView);
        return next;
      });
    },
    [setSearchParams],
  );

  return { query, view, setSearch, setFilters, clearFilters, resetAll, setSort, setPage, setView };
}
