import type { ResourceSummary } from '@academy-library/contracts';
import type { LibraryViewMode } from '../hooks/useLibraryQueryState';
import { ResourceCard } from './ResourceCard';
import styles from './ResourceGrid.module.css';

export interface ResourceGridProps {
  resources: ResourceSummary[];
  view: LibraryViewMode;
}

export function ResourceGrid({ resources, view }: ResourceGridProps) {
  return (
    <ul className={view === 'grid' ? styles.grid : styles.list}>
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} variant={view} />
        </li>
      ))}
    </ul>
  );
}
