import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { IconButton } from '../IconButton';
import styles from './Alert.module.css';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
}

const ICONS: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertOctagon,
};

export function Alert({
  variant = 'info',
  title,
  onDismiss,
  dismissLabel = 'Dismiss',
  role,
  className,
  children,
  ...rest
}: AlertProps) {
  const Icon = ICONS[variant];
  const classes = [styles.alert, styles[variant], className].filter(Boolean).join(' ');
  // Static banners use a polite `status`; only genuinely urgent variants
  // interrupt as `alert`. Callers can still override via the `role` prop.
  const resolvedRole = role ?? (variant === 'danger' || variant === 'warning' ? 'alert' : 'status');

  return (
    <div className={classes} role={resolvedRole} {...rest}>
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.description}>{children}</div>}
      </div>
      {onDismiss && (
        <IconButton
          icon={<X aria-hidden="true" />}
          label={dismissLabel}
          variant="ghost"
          size="sm"
          className={styles.dismiss}
          onClick={onDismiss}
        />
      )}
    </div>
  );
}
