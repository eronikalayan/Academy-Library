import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { getResourceMutationErrorMessage } from '../resourceErrors';

export interface DeleteResourceDialogProps {
  isOpen: boolean;
  resourceTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error?: unknown;
}

/**
 * The one delete-confirmation UI every authorized delete action in the
 * app goes through (`ResourceDetailsPage`, the admin resource list) —
 * there's no `ConfirmDialog` primitive in `shared/ui/` to reuse (see
 * docs/domain/resources.md), so this composes `Modal` + `Button
 * variant="destructive"` directly, the same way `shared/ui/Modal`'s own
 * test harness and `ComingSoonDialog` already do for their own
 * non-destructive dialogs. Closing is blocked while a delete is
 * in-flight — via the backdrop, Escape, and the Cancel button alike —
 * so a request already sent can't be abandoned mid-air from the UI's
 * point of view.
 */
export function DeleteResourceDialog({
  isOpen,
  resourceTitle,
  onCancel,
  onConfirm,
  isDeleting,
  error,
}: DeleteResourceDialogProps) {
  function handleClose() {
    if (!isDeleting) onCancel();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeOnOutsideClick={!isDeleting}
      title="Delete this resource?"
      description={`"${resourceTitle}" will be permanently deleted. This cannot be undone.`}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} isLoading={isDeleting}>
            Delete resource
          </Button>
        </>
      }
    >
      {error !== undefined && error !== null && (
        <Alert variant="danger" role="alert">
          {getResourceMutationErrorMessage(error)}
        </Alert>
      )}
    </Modal>
  );
}
