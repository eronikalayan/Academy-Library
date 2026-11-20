import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../widgets/page-header';
import { useToast } from '../../shared/ui/Toast';
import { useCreateResourceMutation } from './api/useCreateResourceMutation';
import { ResourceForm } from './ResourceForm';
import styles from './ResourceFormPage.module.css';

/**
 * `/library/new` — gated to `LECTURER`/`ADMIN` at the route level (see
 * `app/router/routes.tsx`), since resource creation has no per-resource
 * ownership question to resolve yet (unlike editing, where a signed-in
 * LECTURER's *own* capability still has to be confirmed per-resource —
 * see `EditResourcePage.tsx`). On success, lands on the new resource's
 * real detail page rather than back on the list, so the creator can
 * immediately confirm what they just made looks right.
 */
export function CreateResourcePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateResourceMutation();

  return (
    <div>
      <Link className={styles.backLink} to="/library">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to Explore Library
      </Link>

      <PageHeader
        title="Create resource"
        description="Add a new resource to the library catalogue."
      />

      <ResourceForm
        mode="create"
        isSubmitting={createMutation.isPending}
        submitError={createMutation.error}
        onSubmit={(input) => {
          createMutation.mutate(input, {
            onSuccess: (created) => {
              showToast({
                variant: 'success',
                title: 'Resource created',
                description: `"${created.title}" has been added to the library.`,
              });
              navigate(`/library/${created.id}`, { replace: true });
            },
          });
        }}
      />
    </div>
  );
}
