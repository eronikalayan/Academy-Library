import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: ReactNode;
}

export function Badge({ variant = 'neutral', icon, className, children, ...rest }: BadgeProps) {
  const classes = [styles.badge, styles[variant], className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...rest}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  );
}
