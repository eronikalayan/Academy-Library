import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Shown when `useUnsavedChangesBlocker` intercepts an in-app navigation
 * away from a dirty `ResourceForm` (Task 05D). Composes `Modal` +
 * `Button` the same way `DeleteResourceDialog` does — there is still no
 * generic confirm-dialog primitive in `shared/ui/` (see
 * docs/domain/resources.md). Escape and the backdrop both resolve to
 * "stay" (`onClose` → `onStay`), the same safe default
 * `DeleteResourceDialog` uses for its own non-destructive path: neither
 * should ever be able to trigger the discarding action on its own.
 */
export function UnsavedChangesDialog({ isOpen, onStay, onLeave }: UnsavedChangesDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onStay}
      title="Leave without saving?"
      description="You have unsaved changes. If you leave this page now, those changes will be lost."
      footer={
        <>
          <Button variant="outline" onClick={onStay}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Leave without saving
          </Button>
        </>
      }
    />
  );
}
