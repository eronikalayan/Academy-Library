import { Moon, Monitor, Sun } from 'lucide-react';
import { IconButton } from '../../shared/ui/IconButton';
import { useTheme } from './useTheme';
import type { Theme } from './ThemeContext';
import styles from './ThemeToggle.module.css';

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'Match system theme', icon: Monitor },
];

/**
 * A three-way toggle rather than a `radiogroup`: each option is an
 * independent button that sets the theme outright, so arrow-key
 * navigation semantics aren't required — Tab moves between them like any
 * other button group, and `aria-pressed` reports which is active.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.group} role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <IconButton
          key={value}
          icon={<Icon aria-hidden="true" />}
          label={label}
          variant="ghost"
          size="sm"
          aria-pressed={theme === value}
          className={theme === value ? styles.active : undefined}
          onClick={() => setTheme(value)}
        />
      ))}
    </div>
  );
}
