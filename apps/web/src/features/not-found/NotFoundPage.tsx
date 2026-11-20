import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <section className={styles.container}>
      <SearchX className={styles.icon} aria-hidden="true" />
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.subtitle}>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link className={styles.link} to="/">
        Back to home
      </Link>
    </section>
  );
}
