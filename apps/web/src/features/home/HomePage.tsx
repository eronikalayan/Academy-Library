import { useNavigate } from 'react-router-dom';
import { Library } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <section className={styles.container}>
      <Library className={styles.icon} aria-hidden="true" />
      <h1 className={styles.title}>Academy Library</h1>
      <p className={styles.subtitle}>
        A centralized place to discover and manage educational resources — books, articles, videos,
        and course material.
      </p>
      <Button onClick={() => navigate('/dashboard')}>Enter the library</Button>
    </section>
  );
}
