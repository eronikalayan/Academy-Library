import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from '../../../shared/ui/Badge';
import { Input } from '../../../shared/ui/Input';
import styles from './TagInput.module.css';

export interface TagInputProps {
  label: string;
  helperText?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Known tag names to suggest while typing — purely a convenience list,
   * never a constraint: the backend's tag association is find-or-create
   * (see docs/domain/resources.md), so any trimmed, non-empty text the
   * user types is a valid tag, known or new. */
  suggestions?: readonly string[];
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A free-text, chip-style tag editor — not a checkbox grid against a
 * fixed list like `FilterPanel`'s tag filter, because there is no
 * "every tag that exists" endpoint to check against (tags are a
 * folksonomy with no listing endpoint, unlike courses/groups — see
 * `docs/domain/resources.md`, "Scope decisions"). Typing a comma or
 * pressing Enter commits the current text as a new chip; Backspace on
 * an empty input removes the last one, matching the common chip-input
 * convention without pulling in a new dependency.
 */
export function TagInput({ label, helperText, tags, onChange, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputId = useId();

  function commitDraft() {
    const normalized = normalizeTag(draft);
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((existing) => existing !== tag));
  }

  const unusedSuggestions = suggestions.filter((suggestion) => !tags.includes(suggestion));

  return (
    <div className={styles.field}>
      <Input
        id={inputId}
        label={label}
        helperText={helperText}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder="Type a tag and press Enter"
      />
      {tags.length > 0 && (
        <ul className={styles.chipList} aria-label={`${label} (selected)`}>
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="accent" className={styles.chip}>
                {tag}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X aria-hidden="true" size={12} />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {unusedSuggestions.length > 0 && (
        <div className={styles.suggestions}>
          <span className={styles.suggestionsLabel}>Suggestions:</span>
          {unusedSuggestions.slice(0, 12).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.suggestionButton}
              onClick={() => onChange([...tags, suggestion])}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
