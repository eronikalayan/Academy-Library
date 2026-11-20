import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { getResourceMutationErrorMessage } from '../../library/resourceErrors';

export interface DeleteCollectionDialogProps {
  isOpen: boolean;
  collectionTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error?: unknown;
}

/** Mirrors `DeleteResourceDialog` exactly — same composition, same
 * blocked-while-deleting behavior on the backdrop/Escape/Cancel path.
 * Deleting a collection never deletes the resources inside it (only
 * the collection's own row and its join-table associations — see
 * schema.prisma's `Collection` doc comment), which the description
 * below says explicitly so this isn't mistaken for the more
 * destructive "delete resources" action `DeleteResourceDialog` is. */
export function DeleteCollectionDialog({
  isOpen,
  collectionTitle,
  onCancel,
  onConfirm,
  isDeleting,
  error,
}: DeleteCollectionDialogProps) {
  function handleClose() {
    if (!isDeleting) onCancel();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeOnOutsideClick={!isDeleting}
      title="Delete this collection?"
      description={`"${collectionTitle}" will be permanently deleted. This cannot be undone. The resources inside it are not affected.`}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} isLoading={isDeleting}>
            Delete collection
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
