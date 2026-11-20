import { useState } from 'react';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import { useResourceListQuery } from '../../library/api/useResourceListQuery';
import { useDebouncedValue } from '../../../shared/hooks';
import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { getResourceMutationErrorMessage } from '../../library/resourceErrors';
import styles from './AddResourceToCollectionPanel.module.css';

const SEARCH_PAGE_SIZE = 8;

export interface AddResourceToCollectionPanelProps {
  existingResourceIds: readonly string[];
  isAdding: boolean;
  addError?: unknown;
  onAdd: (resourceId: string) => void;
}

/**
 * A focused search box, not a full resource browser — reuses
 * `useResourceListQuery` directly (the same hook the Library Explorer
 * itself uses), so "which resources can I even add" is governed by the
 * identical visibility rules a direct `/library` search would apply;
 * this never shows a resource the viewer couldn't otherwise find or
 * open. Already-member resources are filtered out of the candidate
 * list client-side — the real duplicate protection is still the
 * backend's own idempotent add (see `collection.service.ts`), this is
 * just avoiding an "Add" button that would visibly do nothing.
 */
export function AddResourceToCollectionPanel({
  existingResourceIds,
  isAdding,
  addError,
  onAdd,
}: AddResourceToCollectionPanelProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const query = ResourceListQuerySchema.parse({
    search: debouncedSearch || undefined,
    sort: debouncedSearch ? 'relevance' : 'newest',
    page: 1,
    pageSize: SEARCH_PAGE_SIZE,
  });
  const { data, isPending, isError } = useResourceListQuery(query);

  const existing = new Set(existingResourceIds);
  const candidates = data?.items.filter((item) => !existing.has(item.id)) ?? [];

  return (
    <div className={styles.panel}>
      <Input
        aria-label="Search resources to add"
        placeholder="Search resources to add…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {addError !== undefined && addError !== null && (
        <Alert variant="danger" role="alert">
          {getResourceMutationErrorMessage(addError)}
        </Alert>
      )}

      {isPending ? (
        <Skeleton height="2.5rem" />
      ) : isError ? (
        <p className={styles.hint}>Couldn't load resources to search right now.</p>
      ) : candidates.length === 0 ? (
        <p className={styles.hint}>
          {search ? 'No matching resources you can add.' : 'Type to search for a resource to add.'}
        </p>
      ) : (
        <ul className={styles.results}>
          {candidates.map((item) => (
            <li key={item.id} className={styles.result}>
              <span className={styles.resultTitle}>{item.title}</span>
              <Button
                size="sm"
                variant="outline"
                isLoading={isAdding}
                onClick={() => onAdd(item.id)}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
