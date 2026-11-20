import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, SearchX } from 'lucide-react';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { PageHeader } from '../../widgets/page-header';
import { Skeleton, SkeletonText } from '../../shared/ui/Skeleton';
import { useToast } from '../../shared/ui/Toast';
import { getResourceDetailErrorMessage } from '../library/resourceErrors';
import { useCollectionDetailQuery } from './api/useCollectionDetailQuery';
import { useUpdateCollectionMutation } from './api/useUpdateCollectionMutation';
import { CollectionForm } from './CollectionForm';
import styles from './CollectionFormPage.module.css';

/**
 * `/collections/:collectionId/edit`. Not role-gated at the route —
 * same reasoning as `EditResourcePage`: a `LECTURER` may edit *their
 * own* collections but not someone else's, which only the fetched
 * collection's own `capabilities.canEdit` can answer. Renders an
 * inline message, not a redirect, matching `RequireRole`'s own
 * established precedent.
 */
export function EditCollectionPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data, error, isPending, isError, refetch } = useCollectionDetailQuery(collectionId);
  const updateMutation = useUpdateCollectionMutation();

  if (isPending) {
    return (
      <div>
        <Skeleton height="2rem" width="60%" />
        <div className={styles.loadingMeta}>
          <Skeleton height="1.5rem" width={90} />
        </div>
        <div>
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

  if (!data.capabilities.canEdit) {
    return (
      <section className={styles.notFound}>
        <Lock className={styles.notFoundIcon} aria-hidden="true" />
        <h1 className={styles.notFoundTitle}>You don&apos;t have access to edit this collection</h1>
        <p className={styles.notFoundSubtitle}>
          Only the collection&apos;s owner or an administrator can make changes to it.
        </p>
        <Link className={styles.notFoundLink} to={`/collections/${data.id}`}>
          Back to collection details
        </Link>
      </section>
    );
  }

  return (
    <div>
      <Link className={styles.backLink} to={`/collections/${data.id}`}>
        <ArrowLeft aria-hidden="true" size={16} />
        Back to collection details
      </Link>

      <PageHeader title="Edit collection" description={`Editing "${data.title}".`} />

      <CollectionForm
        mode="edit"
        initialCollection={data}
        isSubmitting={updateMutation.isPending}
        submitError={updateMutation.error}
        onSubmit={(input) => {
          updateMutation.mutate(
            { id: data.id, input },
            {
              onSuccess: (updated) => {
                showToast({
                  variant: 'success',
                  title: 'Collection updated',
                  description: `Changes to "${updated.title}" have been saved.`,
                });
                navigate(`/collections/${updated.id}`, { replace: true });
              },
            },
          );
        }}
      />
    </div>
  );
}
