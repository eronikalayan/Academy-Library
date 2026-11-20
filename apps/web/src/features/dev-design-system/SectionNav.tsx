import { SECTIONS } from './sections';
import styles from './SectionNav.module.css';

export function SectionNav() {
  return (
    <nav className={styles.nav} aria-label="Design system sections">
      <ul className={styles.list}>
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className={styles.link}>
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
