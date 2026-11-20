import { ComingSoonDialog } from '../../shared/ui/ComingSoonDialog';

export interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The search affordance is intentionally not wired to anything — this is
 * an honest "not built yet" state, not a fake search box that silently
 * does nothing when you type into it.
 */
export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  return (
    <ComingSoonDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Search the library"
      description="You'll be able to search resources, collections, and courses from here."
    />
  );
}
