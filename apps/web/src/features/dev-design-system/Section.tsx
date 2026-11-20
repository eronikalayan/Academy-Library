import type { ReactNode } from 'react';
import styles from './Section.module.css';

export interface SectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.heading}>
        <h2 id={`${id}-heading`} className={styles.title}>
          {title}
        </h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
