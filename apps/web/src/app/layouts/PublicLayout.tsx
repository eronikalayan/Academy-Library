import { Outlet, Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { ThemeToggle } from '../theme/ThemeToggle';
import styles from './PublicLayout.module.css';

/**
 * The pre-authentication shell: today just the marketing home page, but
 * also where a future login/register flow belongs — there's no reason to
 * stand up a second, near-identical empty layout once real auth pages
 * exist.
 */
export function PublicLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <BookOpen className={styles.logo} aria-hidden="true" />
          <span className={styles.wordmark}>Academy Library</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
