import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../Spinner';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'ghost' | 'secondary' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  /** Required accessible name — this button has no visible text label. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    isLoading = false,
    disabled,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-label={label}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" label="" /> : <span className={styles.icon}>{icon}</span>}
    </button>
  );
});
