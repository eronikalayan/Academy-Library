import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  helperText?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, helperText, error, id, className, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const helperId = `${checkboxId}-helper`;
  const errorId = `${checkboxId}-error`;
  const describedBy =
    [helperText ? helperId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label
        htmlFor={checkboxId}
        className={[styles.row, disabled ? styles.rowDisabled : null].filter(Boolean).join(' ')}
      >
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          disabled={disabled}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {label && <span className={styles.label}>{label}</span>}
      </label>
      {error ? (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className={styles.helperText}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
