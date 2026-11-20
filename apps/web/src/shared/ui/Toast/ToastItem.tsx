import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { IconButton } from '../IconButton';
import type { ToastOptions, ToastVariant } from './ToastContext';
import styles from './Toast.module.css';

export interface ToastItemProps extends ToastOptions {
  onDismiss: () => void;
}

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

export function ToastItem({ title, description, variant = 'info', onDismiss }: ToastItemProps) {
  const Icon = ICONS[variant];

  return (
    <div className={[styles.toast, styles[variant]].join(' ')}>
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <IconButton
        icon={<X aria-hidden="true" />}
        label="Dismiss notification"
        variant="ghost"
        size="sm"
        onClick={onDismiss}
      />
    </div>
  );
}
