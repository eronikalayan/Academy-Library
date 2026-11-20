import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Layers, Lock, Pencil, SearchX, Trash2 } from 'lucide-react';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Skeleton, SkeletonText } from '../../shared/ui/Skeleton';
import { useToast } from '../../shared/ui/Toast';
import {
  getResourceDetailErrorMessage,
  getResourceMutationErrorMessage,
} from '../library/resourceErrors';
import { useAddCollectionResourceMutation } from './api/useAddCollectionResourceMutation';
import { useCollectionDetailQuery } from './api/useCollectionDetailQuery';
import { useDeleteCollectionMutation } from './api/useDeleteCollectionMutation';
import { useRemoveCollectionResourceMutation } from './api/useRemoveCollectionResourceMutation';
import { useReorderCollectionResourcesMutation } from './api/useReorderCollectionResourcesMutation';
import { AddResourceToCollectionPanel } from './components/AddResourceToCollectionPanel';
import { CollectionResourceRow } from './components/CollectionResourceRow';
import { DeleteCollectionDialog } from './components/DeleteCollectionDialog';
import styles from './CollectionDetailsPage.module.css';

function formatCreatedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function CollectionDetailsPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data, error, isPending, isError, refetch } = useCollectionDetailQuery(collectionId);
  const deleteMutation = useDeleteCollectionMutation();
  const addMutation = useAddCollectionResourceMutation();
  const removeMutation = useRemoveCollectionResourceMutation();
  const reorderMutation = useReorderCollectionResourcesMutation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (isPending) {
    return (
      <div>
        <Skeleton height="2rem" width="60%" />
        <div className={styles.loadingBody}>
          <SkeletonText lines={4} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="danger" title="Couldn't load this collection">
        {getResourceDetailErrorMessage(error)}
        <div className={styles.retryRow}>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </Alert>
    );
  }

  if (!data) {
    return (
      <section className={styles.notFound}>
        <SearchX className={styles.notFoundIcon} aria-hidden="true" />
        <h1 className={styles.notFoundTitle}>Collection not found</h1>
        <p className={styles.notFoundSubtitle}>
          This collection doesn&apos;t exist, or may have been removed.
        </p>
        <Link className={styles.notFoundLink} to="/collections">
          Back to Collections
        </Link>
      </section>
    );
  }

  const resourceIds = data.resources.map((item) => item.resource.id);
  const isBusy = reorderMutation.isPending || removeMutation.isPending || addMutation.isPending;
  const isRestricted = data.visibility === 'RESTRICTED';

  function moveItem(fromIndex: number, toIndex: number): void {
    if (!data) return;
    if (toIndex < 0 || toIndex >= resourceIds.length) return;
    const movedId = resourceIds[fromIndex];
    if (movedId === undefined) return;

    const next = [...resourceIds];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, movedId);
    reorderMutation.mutate({ collectionId: data.id, resourceIds: next });
  }

  return (
    <div>
      <Link className={styles.backLink} to="/collections">
        Back to Collections
      </Link>

      <header className={styles.header}>
        <div className={styles.badgeRow}>
          {isRestricted && (
            <Badge variant="neutral" icon={<Lock aria-hidden="true" />}>
              Restricted
            </Badge>
          )}
          {/* A display convenience only — `capabilities` is computed
           * server-side; the real enforcement is the backend's own
           * check on every write, same as `ResourceDetailsPage`. */}
          {(data.capabilities.canEdit || data.capabilities.canDelete) && (
            <div className={styles.manageActions}>
              {data.capabilities.canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<Pencil aria-hidden="true" size={14} />}
                  onClick={() => navigate(`/collections/${data.id}/edit`)}
                >
                  Edit
                </Button>
              )}
              {data.capabilities.canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<Trash2 aria-hidden="true" size={14} />}
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
        <h1 className={styles.title}>{data.title}</h1>
        <p className={styles.description}>{data.description}</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="collection-resources-heading">
            <h2 id="collection-resources-heading" className={styles.sectionTitle}>
              Resources ({data.resources.length})
            </h2>

            {data.resources.length === 0 ? (
              <EmptyState
                title="No resources in this collection yet"
                description={
                  data.capabilities.canEdit
                    ? 'Use the search below to add resources.'
                    : "This collection's owner hasn't added any resources yet."
                }
              />
            ) : (
              <ul className={styles.resourceList}>
                {data.resources.map((item, index) => (
                  <li key={item.resource.id}>
                    <CollectionResourceRow
                      item={item}
                      canEdit={data.capabilities.canEdit}
                      isFirst={index === 0}
                      isLast={index === data.resources.length - 1}
                      isBusy={isBusy}
                      onMoveUp={() => moveItem(index, index - 1)}
                      onMoveDown={() => moveItem(index, index + 1)}
                      onRemove={() =>
                        removeMutation.mutate({
                          collectionId: data.id,
                          resourceId: item.resource.id,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            {reorderMutation.isError && (
              <Alert variant="danger" role="alert" className={styles.mutationError}>
                {getResourceMutationErrorMessage(reorderMutation.error)}
              </Alert>
            )}
            {removeMutation.isError && (
              <Alert variant="danger" role="alert" className={styles.mutationError}>
                {getResourceMutationErrorMessage(removeMutation.error)}
              </Alert>
            )}

            {data.capabilities.canEdit && (
              <Card className={styles.addPanelCard}>
                <CardHeader>
                  <CardTitle>Add a resource</CardTitle>
                </CardHeader>
                <CardContent>
                  <AddResourceToCollectionPanel
                    existingResourceIds={resourceIds}
                    isAdding={addMutation.isPending}
                    addError={addMutation.error}
                    onAdd={(resourceId) =>
                      addMutation.mutate({ collectionId: data.id, resourceId })
                    }
                  />
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <aside className={styles.sidebar} aria-label="Collection details">
          <Card padding="md" className={styles.metaCard}>
            <h2 className={styles.metaCardTitle}>At a glance</h2>
            <dl className={styles.metaList}>
              <div className={styles.metaItem}>
                <dt>Resources</dt>
                <dd>
                  <Layers aria-hidden="true" className={styles.metaIcon} />
                  {data.resources.length}
                </dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Created</dt>
                <dd>
                  <Calendar aria-hidden="true" className={styles.metaIcon} />
                  {formatCreatedDate(data.createdAt)}
                </dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Visibility</dt>
                <dd>{isRestricted ? 'Restricted' : 'Public'}</dd>
                {isRestricted && (
                  <p className={styles.metaCaption}>
                    Visible to members of specific groups, and to its owner — enforced by the
                    server, not just hidden from navigation.
                  </p>
                )}
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      {data.capabilities.canDelete && (
        <DeleteCollectionDialog
          isOpen={isDeleteDialogOpen}
          collectionTitle={data.title}
          isDeleting={deleteMutation.isPending}
          error={deleteMutation.error}
          onCancel={() => setIsDeleteDialogOpen(false)}
          onConfirm={() => {
            deleteMutation.mutate(data.id, {
              onSuccess: () => {
                showToast({
                  variant: 'success',
                  title: 'Collection deleted',
                  description: `"${data.title}" has been removed.`,
                });
                navigate('/collections', { replace: true });
              },
            });
          }}
        />
      )}
    </div>
  );
}
