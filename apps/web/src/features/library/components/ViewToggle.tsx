import { LayoutGrid, List } from 'lucide-react';
import { IconButton } from '../../../shared/ui/IconButton';
import type { LibraryViewMode } from '../hooks/useLibraryQueryState';
import styles from './ViewToggle.module.css';

export interface ViewToggleProps {
  view: LibraryViewMode;
  onChange: (view: LibraryViewMode) => void;
}

const OPTIONS: Array<{ value: LibraryViewMode; label: string; icon: typeof LayoutGrid }> = [
  { value: 'grid', label: 'Grid view', icon: LayoutGrid },
  { value: 'list', label: 'List view', icon: List },
];

/** Same pattern as `ThemeToggle`: independent buttons reporting state via
 * `aria-pressed`, not a radiogroup. */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className={styles.group} role="group" aria-label="Layout">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <IconButton
          key={value}
          icon={<Icon aria-hidden="true" />}
          label={label}
          variant="ghost"
          size="sm"
          aria-pressed={view === value}
          className={view === value ? styles.active : undefined}
          onClick={() => onChange(value)}
        />
      ))}
    </div>
  );
}
