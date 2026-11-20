import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../widgets/page-header';
import { useToast } from '../../shared/ui/Toast';
import { useCreateCollectionMutation } from './api/useCreateCollectionMutation';
import { CollectionForm } from './CollectionForm';
import styles from './CollectionFormPage.module.css';

/** `/collections/new` — gated to `LECTURER`/`ADMIN` at the route level
 * (see `app/router/routes.tsx`), same reasoning as `CreateResourcePage`:
 * creation has no per-collection ownership question to resolve yet. */
export function CreateCollectionPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateCollectionMutation();

  return (
    <div>
      <Link className={styles.backLink} to="/collections">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to Collections
      </Link>

      <PageHeader
        title="Create collection"
        description="Organize resources into a named, ordered collection."
      />

      <CollectionForm
        mode="create"
        isSubmitting={createMutation.isPending}
        submitError={createMutation.error}
        onSubmit={(input) => {
          createMutation.mutate(input, {
            onSuccess: (created) => {
              showToast({
                variant: 'success',
                title: 'Collection created',
                description: `"${created.title}" has been created.`,
              });
              navigate(`/collections/${created.id}`, { replace: true });
            },
          });
        }}
      />
    </div>
  );
}
