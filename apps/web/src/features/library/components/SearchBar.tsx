import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '../../../shared/hooks';
import { IconButton } from '../../../shared/ui/IconButton';
import { Input } from '../../../shared/ui/Input';
import styles from './SearchBar.module.css';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const DEBOUNCE_MS = 300;

/** A local draft is kept so typing feels instant; `onChange` (which
 * updates the URL) only fires once typing pauses for `DEBOUNCE_MS`. */
export function SearchBar({ value, onChange }: SearchBarProps) {
  const [draft, setDraft] = useState(value);
  const debouncedDraft = useDebouncedValue(draft, DEBOUNCE_MS);

  // The URL is the source of truth — if it changes from elsewhere (a
  // "Clear filters" action, browser back/forward), the draft follows.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (debouncedDraft !== value) onChange(debouncedDraft);
    // Only the debounced value settling should trigger a commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  return (
    <Input
      // Not `type="search"` — browsers render their own built-in clear
      // button for that input type, which would duplicate the custom one
      // below as soon as there's a value.
      type="text"
      aria-label="Search the library"
      placeholder="Search by title, author, or topic…"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      leadingIcon={<Search aria-hidden="true" />}
      trailingIcon={
        draft ? (
          <IconButton
            icon={<X aria-hidden="true" />}
            label="Clear search"
            variant="ghost"
            size="sm"
            className={styles.clearButton}
            onClick={() => setDraft('')}
          />
        ) : undefined
      }
      className={styles.search}
    />
  );
}
