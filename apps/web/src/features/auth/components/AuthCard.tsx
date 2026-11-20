import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import styles from './AuthCard.module.css';

export interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** The shared visual frame for `LoginPage`/`RegisterPage` — a single
 * centered card inside `PublicLayout`'s existing header/main shell,
 * rather than a second, parallel page layout. Kept deliberately simple
 * (one card, no split-screen hero) to match this app's existing
 * restrained, content-first aesthetic (see HomePage, PublicLayout). */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <BookOpen className={styles.icon} aria-hidden="true" />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
