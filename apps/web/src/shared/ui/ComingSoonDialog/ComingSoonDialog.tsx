import { Sparkles } from 'lucide-react';
import { EmptyState } from '../EmptyState';
import { Modal } from '../Modal';

export interface ComingSoonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

/**
 * A consistent, honest "not built yet" response for actions that don't
 * have anywhere real to go (e.g. creating a resource before CRUD
 * exists) — not a fake success state, and not a dead button either.
 */
export function ComingSoonDialog({ isOpen, onClose, title, description }: ComingSoonDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <EmptyState
        icon={<Sparkles aria-hidden="true" />}
        title="Coming soon"
        description={description}
      />
    </Modal>
  );
}
