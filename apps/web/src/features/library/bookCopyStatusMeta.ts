import type { BookCopyStatus } from '@academy-library/contracts';
import type { BadgeVariant } from '../../shared/ui/Badge';

export const BOOK_COPY_STATUS_META: Record<
  BookCopyStatus,
  { label: string; badgeVariant: BadgeVariant }
> = {
  AVAILABLE: { label: 'Available', badgeVariant: 'success' },
  ON_LOAN: { label: 'On loan', badgeVariant: 'warning' },
  ARCHIVED: { label: 'Archived', badgeVariant: 'neutral' },
};
