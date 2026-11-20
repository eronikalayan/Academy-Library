import styles from './Spinner.module.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Announced to screen readers; visually hidden. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Loading…', className }: SpinnerProps) {
  const classes = [styles.spinner, styles[size], className].filter(Boolean).join(' ');

  return (
    <span className={styles.wrapper} role="status">
      <svg className={classes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className={styles.track} cx="12" cy="12" r="10" strokeWidth="3" />
        <path
          className={styles.indicator}
          d="M12 2a10 10 0 0 1 10 10"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
