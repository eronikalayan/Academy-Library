import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../IconButton';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Deliberately simple: every page number is rendered (no first/last +
 * ellipsis windowing) — with a fixed page size, the Library Explorer's
 * fixture catalogue never produces enough pages to need it. Revisit if a
 * future list regularly produces double-digit page counts.
 */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Pagination"
      className={[styles.pagination, className].filter(Boolean).join(' ')}
    >
      <IconButton
        icon={<ChevronLeft aria-hidden="true" />}
        label="Previous page"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      <ul className={styles.list}>
        {pageNumbers.map((pageNumber) => {
          const isCurrent = pageNumber === page;
          return (
            <li key={pageNumber}>
              <button
                type="button"
                className={[styles.pageButton, isCurrent ? styles.pageButtonActive : null]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${pageNumber}`}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            </li>
          );
        })}
      </ul>
      <IconButton
        icon={<ChevronRight aria-hidden="true" />}
        label="Next page"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
