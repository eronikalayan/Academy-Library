import type { ReactNode } from 'react';
import { Card } from '../Card';
import styles from './StatCard.module.css';

export interface StatCardProps {
  icon: ReactNode;
  label: string;
  /** Defaults to an em dash — a deliberate "no data yet" placeholder, not a fabricated number. */
  value?: string;
  caption?: string;
}

export function StatCard({ icon, label, value = '—', caption }: StatCardProps) {
  return (
    <Card padding="md" className={styles.card}>
      <div className={styles.iconWrap} aria-hidden="true">
        {icon}
      </div>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {caption && <p className={styles.caption}>{caption}</p>}
    </Card>
  );
}
