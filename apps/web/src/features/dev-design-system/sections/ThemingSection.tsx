import { ThemeToggle } from '../../../app/theme/ThemeToggle';
import { useTheme } from '../../../app/theme/useTheme';
import { Section } from '../Section';
import styles from './ThemingSection.module.css';

export function ThemingSection() {
  const { theme, resolvedTheme } = useTheme();

  return (
    <Section
      id="theming"
      title="Theming"
      description="The same toggle shown in the app header — System follows prefers-color-scheme; Light/Dark pin an explicit choice to localStorage."
    >
      <div className={styles.row}>
        <ThemeToggle />
        <p className={styles.status}>
          Preference: <strong>{theme}</strong> — resolved to <strong>{resolvedTheme}</strong>
        </p>
      </div>
    </Section>
  );
}
