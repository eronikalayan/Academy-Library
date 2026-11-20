import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, SearchX } from 'lucide-react';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { PageHeader } from '../../widgets/page-header';
import { Skeleton, SkeletonText } from '../../shared/ui/Skeleton';
import { useToast } from '../../shared/ui/Toast';
import { useResourceDetailQuery } from './api/useResourceDetailQuery';
import { useUpdateResourceMutation } from './api/useUpdateResourceMutation';
import { getResourceDetailErrorMessage } from './resourceErrors';
import { ResourceForm } from './ResourceForm';
import styles from './ResourceFormPage.module.css';

/**
 * `/library/:resourceId/edit`. Unlike `/library/new`, whether this page
 * is even reachable can't be decided by role alone — a `LECTURER` may
 * edit *their own* resources but not someone else's (see
 * `apps/api/src/modules/resources/resource.policy.ts`'s
 * `canModifyResource`), and the frontend has no reliable way to know
 * which case applies without the real resource in hand. So this is an
 * in-page check against the fetched resource's own `capabilities.canEdit`
 * (computed server-side, never guessed from `creatorName` or any other
 * identity-adjacent field — see `ResourceCapabilitiesSchema`'s doc
 * comment), not a route guard — matching `RequireRole`'s own precedent
 * of an inline message rather than a redirect when access is denied.
 */
export function EditResourcePage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data, error, isPending, isError, refetch } = useResourceDetailQuery(resourceId);
  const updateMutation = useUpdateResourceMutation();

  if (isPending) {
    return (
      <div>
        <Skeleton height="2rem" width="60%" />
        <div className={styles.loadingMeta}>
          <Skeleton height="1.5rem" width={90} />
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
      <Alert variant="danger" title="Couldn't load this resource">
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
        <h1 className={styles.notFoundTitle}>Resource not found</h1>
        <p className={styles.notFoundSubtitle}>
          This resource doesn&apos;t exist, or may have been removed.
        </p>
        <Link className={styles.notFoundLink} to="/library">
          Back to Explore Library
        </Link>
      </section>
    );
  }

  if (!data.capabilities.canEdit) {
    return (
      <section className={styles.notFound}>
        <Lock className={styles.notFoundIcon} aria-hidden="true" />
        <h1 className={styles.notFoundTitle}>You don&apos;t have access to edit this resource</h1>
        <p className={styles.notFoundSubtitle}>
          Only the resource&apos;s owner or an administrator can make changes to it.
        </p>
        <Link className={styles.notFoundLink} to={`/library/${data.id}`}>
          Back to resource details
        </Link>
      </section>
    );
  }

  return (
    <div>
      <Link className={styles.backLink} to={`/library/${data.id}`}>
        <ArrowLeft aria-hidden="true" size={16} />
        Back to resource details
      </Link>

      <PageHeader title="Edit resource" description={`Editing "${data.title}".`} />

      <ResourceForm
        mode="edit"
        initialResource={data}
        isSubmitting={updateMutation.isPending}
        submitError={updateMutation.error}
        onSubmit={(input) => {
          updateMutation.mutate(
            { id: data.id, input },
            {
              onSuccess: (updated) => {
                showToast({
                  variant: 'success',
                  title: 'Resource updated',
                  description: `Changes to "${updated.title}" have been saved.`,
                });
                navigate(`/library/${updated.id}`, { replace: true });
              },
            },
          );
        }}
      />
    </div>
  );
}
