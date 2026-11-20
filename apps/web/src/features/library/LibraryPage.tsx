import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useCurrentUser } from '../auth/api/useCurrentUser';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Pagination } from '../../shared/ui/Pagination';
import { PageHeader } from '../../widgets/page-header';
import { useResourceListQuery } from './api/useResourceListQuery';
import { FilterPanel } from './components/FilterPanel';
import { LibrarySkeletonGrid } from './components/LibrarySkeletonGrid';
import { ResourceGrid } from './components/ResourceGrid';
import { SearchBar } from './components/SearchBar';
import { SortSelect } from './components/SortSelect';
import { ViewToggle } from './components/ViewToggle';
import { useLibraryQueryState } from './hooks/useLibraryQueryState';
import { getResourceListErrorMessage } from './resourceErrors';
import styles from './LibraryPage.module.css';

function countActiveFilters(filters: {
  type?: string;
  difficulty?: string;
  courseId?: string;
  tags?: string[];
}): number {
  return (
    [filters.type, filters.difficulty, filters.courseId].filter(Boolean).length +
    (filters.tags?.length ?? 0)
  );
}

export function LibraryPage() {
  const navigate = useNavigate();
  const { query, view, setSearch, setFilters, clearFilters, resetAll, setSort, setPage, setView } =
    useLibraryQueryState();
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const { data, error, isPending, isError, isFetching, refetch } = useResourceListQuery(query);
  const { data: currentUser } = useCurrentUser();
  // A display convenience only — the real authority is the backend's
  // own `canCreateResource` policy, enforced again on every `POST
  // /resources` regardless of what this button shows (same pattern as
  // every other role-conditional affordance in this app, e.g.
  // `SidebarNav`'s admin-only items).
  const canCreateResource = currentUser?.role === 'LECTURER' || currentUser?.role === 'ADMIN';

  // A page number from a shared/stale link can land past the end of the
  // *current* result set (filters narrowed it, or the catalogue shrank)
  // — the backend is authoritative here and correctly returns an empty
  // `items` array rather than silently clamping (see
  // docs/domain/resources.md, "Pagination"), but showing that as "the
  // library is empty" would be actively misleading when results exist,
  // just not on this page. Self-correct to the last real page instead.
  const outOfRangeTotalPages =
    data && data.totalItems > 0 && data.page > data.totalPages ? data.totalPages : undefined;
  useEffect(() => {
    if (outOfRangeTotalPages !== undefined) {
      setPage(outOfRangeTotalPages);
    }
  }, [outOfRangeTotalPages, setPage]);

  const activeFilterCount = countActiveFilters(query);
  const hasActiveQuery = Boolean(query.search) || activeFilterCount > 0;

  const rangeStart = data && data.totalItems > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const rangeEnd = data ? Math.min(data.page * data.pageSize, data.totalItems) : 0;

  return (
    <div>
      <PageHeader
        title="Explore Library"
        description="Search and browse every resource in Academy Library — books, articles, videos, and more."
        actions={
          canCreateResource ? (
            <Button
              leadingIcon={<Plus aria-hidden="true" />}
              onClick={() => navigate('/library/new')}
            >
              Create resource
            </Button>
          ) : undefined
        }
      />

      <div className={styles.toolbar}>
        <SearchBar value={query.search ?? ''} onChange={setSearch} />

        <div className={styles.toolbarRow}>
          <Button
            variant="outline"
            leadingIcon={<SlidersHorizontal aria-hidden="true" />}
            aria-expanded={isFilterPanelOpen}
            onClick={() => setIsFilterPanelOpen((open) => !open)}
          >
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="accent" className={styles.filterCountBadge}>
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <div className={styles.toolbarSpacer} />

          <SortSelect sort={query.sort} hasSearchTerm={Boolean(query.search)} onChange={setSort} />
          <ViewToggle view={view} onChange={setView} />
        </div>

        {isFilterPanelOpen && (
          <FilterPanel
            filters={{
              type: query.type,
              difficulty: query.difficulty,
              courseId: query.courseId,
              tags: query.tags,
            }}
            onApply={(filters) => {
              setFilters(filters);
              setIsFilterPanelOpen(false);
            }}
            onClear={() => {
              clearFilters();
              setIsFilterPanelOpen(false);
            }}
          />
        )}
      </div>

      {isPending || outOfRangeTotalPages !== undefined ? (
        // The out-of-range case is deliberately shown as loading, not as
        // an empty result — `setPage` above is already correcting the URL
        // on this same tick; rendering the (momentarily misleading) empty
        // state in between would just flash and disappear.
        <LibrarySkeletonGrid view={view} />
      ) : isError ? (
        <Alert variant="danger" title="Couldn't load the library">
          {getResourceListErrorMessage(error)}
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : data.items.length === 0 ? (
        hasActiveQuery ? (
          <EmptyState
            title="No resources match your search"
            description="Try a different search term, or clear your filters to see everything in the library."
            action={
              <Button variant="outline" onClick={resetAll}>
                Clear search & filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="The library is empty"
            description="There are no resources in Academy Library yet. Check back soon."
          />
        )
      ) : (
        <>
          <p className={styles.resultCount} aria-live="polite">
            Showing {rangeStart}–{rangeEnd} of {data.totalItems} resource
            {data.totalItems === 1 ? '' : 's'}
          </p>
          <div className={isFetching ? styles.gridUpdating : undefined}>
            <ResourceGrid resources={data.items} view={view} />
          </div>
          <div className={styles.paginationRow}>
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
