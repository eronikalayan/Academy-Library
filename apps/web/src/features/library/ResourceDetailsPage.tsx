import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Calendar, ExternalLink, Lock, Pencil, SearchX, Trash2 } from 'lucide-react';
import { useResourceDetailQuery } from './api/useResourceDetailQuery';
import { useDeleteResourceMutation } from './api/useDeleteResourceMutation';
import { useIsResourceSaved } from '../saved/api/useIsResourceSaved';
import { useSaveResourceMutation } from '../saved/api/useSaveResourceMutation';
import { useUnsaveResourceMutation } from '../saved/api/useUnsaveResourceMutation';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Skeleton, SkeletonText } from '../../shared/ui/Skeleton';
import { useToast } from '../../shared/ui/Toast';
import { isSafeHttpUrl } from '../../shared/data/resources';
import { DeleteResourceDialog } from './components/DeleteResourceDialog';
import { PhysicalCopiesSection } from './components/PhysicalCopiesSection';
import { formatDuration } from './formatDuration';
import { getResourceDetailErrorMessage, getResourceMutationErrorMessage } from './resourceErrors';
import { RESOURCE_DIFFICULTY_META, RESOURCE_TYPE_META } from './resourceTypeMeta';
import styles from './ResourceDetailsPage.module.css';

function formatPublishedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ResourceDetailsPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data, error, isPending, isError, refetch } = useResourceDetailQuery(resourceId);
  const deleteMutation = useDeleteResourceMutation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isSaved } = useIsResourceSaved(resourceId);
  const saveMutation = useSaveResourceMutation();
  const unsaveMutation = useUnsaveResourceMutation();
  const isSaveToggleBusy = saveMutation.isPending || unsaveMutation.isPending;

  if (isPending) {
    return (
      <div>
        <Skeleton height="2rem" width="60%" />
        <div className={styles.loadingMeta}>
          <Skeleton height="1.5rem" width={90} />
          <Skeleton height="1.5rem" width={90} />
        </div>
        <div className={styles.loadingLayout}>
          <SkeletonText lines={5} />
          <Skeleton height="14rem" />
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

  const typeMeta = RESOURCE_TYPE_META[data.type];
  const difficultyMeta = RESOURCE_DIFFICULTY_META[data.difficulty];
  const TypeIcon = typeMeta.icon;
  const canOpenSource = isSafeHttpUrl(data.sourceUrl);
  const hasDuration = data.type === 'VIDEO' || data.type === 'RECORDING';
  const isRestricted = data.visibility === 'RESTRICTED';

  return (
    <div>
      <Link className={styles.backLink} to="/library">
        Back to Explore Library
      </Link>

      <header className={styles.header}>
        <div className={styles.badgeRow}>
          <Badge icon={<TypeIcon aria-hidden="true" />}>{typeMeta.label}</Badge>
          <Badge variant={difficultyMeta.badgeVariant}>{difficultyMeta.label}</Badge>
          {isRestricted && (
            <Badge variant="neutral" icon={<Lock aria-hidden="true" />}>
              Restricted
            </Badge>
          )}
          {/* A display convenience only — `capabilities` is computed
           * server-side (see `ResourceCapabilitiesSchema`), and the
           * real enforcement is the backend's own check on `PATCH`/
           * `DELETE`, not this button's mere presence. The Save toggle
           * is unconditional — unlike Edit/Delete, saving a resource
           * has no ownership requirement, any authenticated viewer can
           * bookmark any resource they can see. */}
          <div className={styles.manageActions}>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={
                <Bookmark aria-hidden="true" size={14} fill={isSaved ? 'currentColor' : 'none'} />
              }
              isLoading={isSaveToggleBusy}
              onClick={() => {
                const onError = (mutationError: unknown) => {
                  showToast({
                    variant: 'error',
                    title: isSaved ? "Couldn't remove from saved" : "Couldn't save resource",
                    description: getResourceMutationErrorMessage(mutationError),
                  });
                };
                if (isSaved) {
                  unsaveMutation.mutate(data.id, { onError });
                } else {
                  saveMutation.mutate(data.id, { onError });
                }
              }}
            >
              {isSaved ? 'Saved' : 'Save'}
            </Button>
            {(data.capabilities.canEdit || data.capabilities.canDelete) && (
              <>
                {data.capabilities.canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    leadingIcon={<Pencil aria-hidden="true" size={14} />}
                    onClick={() => navigate(`/library/${data.id}/edit`)}
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
              </>
            )}
          </div>
        </div>
        <h1 className={styles.title}>{data.title}</h1>
        <p className={styles.creator}>
          {data.creator.name}
          {data.creator.affiliation && <span> · {data.creator.affiliation}</span>}
        </p>

        {canOpenSource && (
          <a
            href={data.sourceUrl ?? undefined}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.sourceLink}
          >
            <ExternalLink aria-hidden="true" />
            Open original resource
          </a>
        )}
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="resource-about-heading">
            <h2 id="resource-about-heading" className={styles.sectionTitle}>
              About this resource
            </h2>
            <p className={styles.description}>{data.description}</p>
          </section>

          {data.type === 'BOOK' && <PhysicalCopiesSection resourceId={data.id} />}
        </div>

        <aside className={styles.sidebar} aria-label="Resource details">
          <Card padding="md" className={styles.metaCard}>
            <h2 className={styles.metaCardTitle}>At a glance</h2>
            <dl className={styles.metaList}>
              {hasDuration && (
                <div className={styles.metaItem}>
                  <dt>Duration</dt>
                  <dd>{formatDuration(data.durationSeconds)}</dd>
                </div>
              )}
              {data.publishedAt && (
                <div className={styles.metaItem}>
                  <dt>Published</dt>
                  <dd>
                    <Calendar aria-hidden="true" className={styles.metaIcon} />
                    {formatPublishedDate(data.publishedAt)}
                  </dd>
                </div>
              )}
              {data.publisher && (
                <div className={styles.metaItem}>
                  <dt>Publisher</dt>
                  <dd>{data.publisher}</dd>
                </div>
              )}
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

            {data.courses.length > 0 && (
              <div className={styles.metaChipGroup}>
                <p className={styles.metaChipLabel}>Courses</p>
                <ul className={styles.tagList}>
                  {data.courses.map((course) => (
                    <li key={course.id}>
                      <Badge variant="neutral">{course.title}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.tags.length > 0 && (
              <div className={styles.metaChipGroup}>
                <p className={styles.metaChipLabel}>Tags</p>
                <ul className={styles.tagList}>
                  {data.tags.map((tag) => (
                    <li key={tag}>
                      <Badge variant="neutral">{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </aside>
      </div>

      {data.capabilities.canDelete && (
        <DeleteResourceDialog
          isOpen={isDeleteDialogOpen}
          resourceTitle={data.title}
          isDeleting={deleteMutation.isPending}
          error={deleteMutation.error}
          onCancel={() => setIsDeleteDialogOpen(false)}
          onConfirm={() => {
            deleteMutation.mutate(data.id, {
              onSuccess: () => {
                showToast({
                  variant: 'success',
                  title: 'Resource deleted',
                  description: `"${data.title}" has been removed from the library.`,
                });
                navigate('/library', { replace: true });
              },
            });
          }}
        />
      )}
    </div>
  );
}
