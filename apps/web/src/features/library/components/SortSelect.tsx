import type { ResourceSort } from '@academy-library/contracts';
import { Select } from '../../../shared/ui/Select';

export interface SortSelectProps {
  sort: ResourceSort;
  /** "Relevance" is only a meaningful option while there's an active
   * search term — this component doesn't decide that, the caller does,
   * so it never renders an option that can't actually do anything. */
  hasSearchTerm: boolean;
  onChange: (sort: ResourceSort) => void;
}

export function SortSelect({ sort, hasSearchTerm, onChange }: SortSelectProps) {
  return (
    <Select
      label="Sort by"
      value={sort}
      onChange={(event) => onChange(event.target.value as ResourceSort)}
    >
      {hasSearchTerm && <option value="relevance">Relevance</option>}
      <option value="newest">Newest</option>
      <option value="title_asc">Title A–Z</option>
    </Select>
  );
}
