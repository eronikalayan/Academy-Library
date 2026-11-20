import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Plus } from 'lucide-react';
import { CollectionListQuerySchema } from '@academy-library/contracts';
import { useCurrentUser } from '../auth/api/useCurrentUser';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Input } from '../../shared/ui/Input';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { useDebouncedValue } from '../../shared/hooks';
import { PageHeader } from '../../widgets/page-header';
import { useCollectionListQuery } from './api/useCollectionListQuery';
import { CollectionCard } from './components/CollectionCard';
import styles from './CollectionsPage.module.css';

const PAGE_SIZE = 12;

/**
 * `/collections` — every signed-in role reaches this same page (unlike
 * `/admin/resources`, which is `ADMIN`-only): a `STUDENT` sees it
 * read-only, a `LECTURER`/`ADMIN` additionally sees "Create collection."
 * Mirrors `ManageResourcesPage`'s simpler search+pagination+card-grid
 * shape rather than the full Library Explorer's filter panel — this
 * domain doesn't have type/difficulty/course facets to filter by.
 */
export function CollectionsPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const canCreateCollection = currentUser?.role === 'LECTURER' || currentUser?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = CollectionListQuerySchema.parse({
    search: debouncedSearch || undefined,
    sort: 'newest',
    page,
    pageSize: PAGE_SIZE,
  });
  const { data, error, isPending, isError, refetch, isFetching } = useCollectionListQuery(query);

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Group resources together — for a course, a reading list, or a topic you're exploring."
        actions={
          canCreateCollection ? (
            <Button
              leadingIcon={<Plus aria-hidden="true" />}
              onClick={() => navigate('/collections/new')}
            >
              Create collection
            </Button>
          ) : undefined
        }
      />

      <Input
        aria-label="Search collections"
        placeholder="Search by title or description…"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        className={styles.search}
      />

      {isPending ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height="14rem" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger" title="Couldn't load collections">
          {error instanceof Error ? error.message : 'Something went wrong.'}
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden="true" />}
          title={
            search ? 'No collections match your search' : "You haven't created any collections yet"
          }
          description={
            search
              ? 'Try a different search term.'
              : 'Collections let you organize resources into named groups. Start by browsing the library.'
          }
          action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
        />
      ) : (
        <>
          <div
            className={[styles.grid, isFetching ? styles.gridUpdating : undefined]
              .filter(Boolean)
              .join(' ')}
          >
            {data.items.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
          <div className={styles.paginationRow}>
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
