import { Skeleton } from '../../../shared/ui/Skeleton';
import type { LibraryViewMode } from '../hooks/useLibraryQueryState';
import styles from './LibrarySkeletonGrid.module.css';

export interface LibrarySkeletonGridProps {
  view: LibraryViewMode;
  count?: number;
}

/** Shaped like the real grid/list so the layout doesn't jump once data
 * arrives. `role="status"` announces the loading state once; the
 * individual skeleton blocks stay `aria-hidden` (see Skeleton). */
export function LibrarySkeletonGrid({ view, count = 8 }: LibrarySkeletonGridProps) {
  return (
    <div
      className={view === 'grid' ? styles.grid : styles.list}
      role="status"
      aria-label="Loading resources"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={view === 'grid' ? styles.gridCard : styles.listCard}>
          <Skeleton
            className={styles.cover}
            radius="sm"
            width={view === 'grid' ? '100%' : 120}
            height={view === 'grid' ? 150 : 88}
          />
          <div className={styles.body}>
            <Skeleton height="0.75rem" width="40%" />
            <Skeleton height="1rem" width="80%" />
            <Skeleton height="0.75rem" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}
