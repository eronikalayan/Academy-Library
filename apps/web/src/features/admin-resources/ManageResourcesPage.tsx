import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library, Pencil, Plus, Trash2 } from 'lucide-react';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import { useResourceListQuery } from '../library/api/useResourceListQuery';
import { useDeleteResourceMutation } from '../library/api/useDeleteResourceMutation';
import { DeleteResourceDialog } from '../library/components/DeleteResourceDialog';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Input } from '../../shared/ui/Input';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { useToast } from '../../shared/ui/Toast';
import { useDebouncedValue } from '../../shared/hooks';
import { PageHeader } from '../../widgets/page-header';
import styles from './ManageResourcesPage.module.css';

const PAGE_SIZE = 20;

/**
 * This page is reached only via `RequireRole roles={['ADMIN']}` (see
 * `app/router/routes.tsx`), so every row's Edit/Delete action renders
 * unconditionally — an `ADMIN` already has `capabilities.canEdit`/
 * `canDelete` on every resource (see
 * `resource.policy.ts`'s `canModifyResource`), so there's no per-row
 * capability check to make the way `ResourceDetailsPage` has to make
 * for a `LECTURER` who might not own what they're looking at.
 */
export function ManageResourcesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = ResourceListQuerySchema.parse({
    search: debouncedSearch || undefined,
    sort: 'newest',
    page,
    pageSize: PAGE_SIZE,
  });
  const { data, error, isPending, isError, refetch, isFetching } = useResourceListQuery(query);

  const deleteMutation = useDeleteResourceMutation();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTitle = data?.items.find((item) => item.id === pendingDeleteId)?.title ?? '';

  return (
    <div>
      <PageHeader
        title="Manage Resources"
        description="Add, edit, and retire resources in the catalogue."
        actions={
          <Button
            leadingIcon={<Plus aria-hidden="true" />}
            onClick={() => navigate('/library/new')}
          >
            Add resource
          </Button>
        }
      />

      <Input
        aria-label="Search resources to manage"
        placeholder="Search by title, author, or topic…"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        className={styles.search}
      />

      {isPending ? (
        <div className={styles.list}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="4rem" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger" title="Couldn't load resources">
          {error instanceof Error ? error.message : 'Something went wrong.'}
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Library aria-hidden="true" />}
          title={search ? 'No resources match your search' : 'No resources in the catalogue yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create the first resource to get the catalogue started.'
          }
        />
      ) : (
        <>
          <ul className={[styles.list, isFetching ? styles.listUpdating : undefined].join(' ')}>
            {data.items.map((item) => (
              <li key={item.id}>
                <Card padding="sm" className={styles.row}>
                  <div className={styles.rowInfo}>
                    <p className={styles.rowTitle}>{item.title}</p>
                    <div className={styles.rowMeta}>
                      <Badge>{item.type}</Badge>
                      <Badge variant="neutral">{item.difficulty}</Badge>
                      {item.visibility === 'RESTRICTED' && (
                        <Badge variant="danger">Restricted</Badge>
                      )}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <Button
                      variant="outline"
                      size="sm"
                      leadingIcon={<Pencil aria-hidden="true" size={14} />}
                      onClick={() => navigate(`/library/${item.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leadingIcon={<Trash2 aria-hidden="true" size={14} />}
                      onClick={() => setPendingDeleteId(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <div className={styles.paginationRow}>
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <DeleteResourceDialog
        isOpen={pendingDeleteId !== null}
        resourceTitle={pendingDeleteTitle}
        isDeleting={deleteMutation.isPending}
        error={deleteMutation.error}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteMutation.mutate(pendingDeleteId, {
            onSuccess: () => {
              showToast({
                variant: 'success',
                title: 'Resource deleted',
                description: `"${pendingDeleteTitle}" has been removed from the library.`,
              });
              setPendingDeleteId(null);
            },
          });
        }}
      />
    </div>
  );
}
