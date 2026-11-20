import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  label?: ReactNode;
  helperText?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, helperText, id, className, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const helperId = `${switchId}-helper`;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label
        htmlFor={switchId}
        className={[styles.row, disabled ? styles.rowDisabled : null].filter(Boolean).join(' ')}
      >
        <span className={styles.switch}>
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            id={switchId}
            disabled={disabled}
            className={styles.input}
            aria-describedby={helperText ? helperId : undefined}
            {...rest}
          />
          <span className={styles.track} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </label>
      {helperText && (
        <p id={helperId} className={styles.helperText}>
          {helperText}
        </p>
      )}
    </div>
  );
});
