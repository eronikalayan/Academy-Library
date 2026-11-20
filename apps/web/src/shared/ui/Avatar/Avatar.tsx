import { useState } from 'react';
import styles from './Avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string;
  /** The person's name — used as the accessible name and for the initials fallback. */
  name: string;
  size?: AvatarSize;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const classes = [styles.avatar, styles[size], className].filter(Boolean).join(' ');
  const showImage = Boolean(src) && !imageFailed;

  if (showImage && src) {
    return (
      <span className={classes}>
        <img src={src} alt={name} className={styles.image} onError={() => setImageFailed(true)} />
      </span>
    );
  }

  return (
    <span className={classes} role="img" aria-label={name}>
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  );
}
