import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Pagination } from '../../shared/ui/Pagination';
import { PageHeader } from '../../widgets/page-header';
import { ResourceGrid } from '../library/components/ResourceGrid';
import { LibrarySkeletonGrid } from '../library/components/LibrarySkeletonGrid';
import { getResourceListErrorMessage } from '../library/resourceErrors';
import { useBookmarksQuery } from './api/useBookmarksQuery';
import styles from './SavedPage.module.css';

const PAGE_SIZE = 12;

/**
 * `/saved` — now backed by real database-level pagination (Task 07),
 * matching the Library Explorer and Collections list rather than a
 * single capped page (Task 06's `SAVED_RESOURCES_PAGE_SIZE`). A
 * resource that's since become inaccessible to this viewer (its
 * visibility changed, or they lost group membership after saving it) is
 * never listed here — `GET /bookmarks` already filters those out
 * server-side (see `bookmark.service.ts`), so this page never needs to
 * re-check visibility itself.
 */
export function SavedPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, error, isPending, isError, refetch, isFetching } = useBookmarksQuery({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Saved Resources"
        description="Resources you've bookmarked for later, all in one place."
      />

      {isPending ? (
        <LibrarySkeletonGrid view="grid" />
      ) : isError ? (
        <Alert variant="danger" title="Couldn't load your saved resources">
          {getResourceListErrorMessage(error)}
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Bookmark aria-hidden="true" />}
          title="No saved resources yet"
          description="When you save a book, article, or video from the library, it will show up here."
          action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
        />
      ) : (
        <>
          <div className={isFetching ? styles.updating : undefined}>
            <ResourceGrid resources={data.items.map((item) => item.resource)} view="grid" />
          </div>
          {data.totalPages > 1 && (
            <div className={styles.paginationRow}>
              <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
