import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Radio.module.css';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  helperText?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, helperText, id, className, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const radioId = id ?? generatedId;
  const helperId = `${radioId}-helper`;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label
        htmlFor={radioId}
        className={[styles.row, disabled ? styles.rowDisabled : null].filter(Boolean).join(' ')}
      >
        <input
          ref={ref}
          type="radio"
          id={radioId}
          disabled={disabled}
          className={styles.input}
          aria-describedby={helperText ? helperId : undefined}
          {...rest}
        />
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
