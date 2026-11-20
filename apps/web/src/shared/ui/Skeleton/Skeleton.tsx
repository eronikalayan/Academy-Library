import type { AvatarSize } from '../Avatar';
import styles from './Skeleton.module.css';

export type SkeletonRadius = 'sm' | 'md' | 'lg' | 'full';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: SkeletonRadius;
  className?: string;
}

/** A single placeholder block. Purely decorative — wrap a group of these
 * in a container with `role="status"` (or rely on an ancestor's
 * `aria-busy`) so screen readers know content is loading. */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'sm',
  className,
}: SkeletonProps) {
  const classes = [styles.skeleton, styles[`radius-${radius}`], className]
    .filter(Boolean)
    .join(' ');
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return <span className={classes} style={style} aria-hidden="true" />;
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={[styles.textGroup, className].filter(Boolean).join(' ')} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height="0.75rem" width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  );
}

const AVATAR_DIMENSIONS: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 40, xl: 56 };

export interface SkeletonAvatarProps {
  size?: AvatarSize;
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  const dimension = AVATAR_DIMENSIONS[size];
  return <Skeleton width={dimension} height={dimension} radius="full" className={className} />;
}

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <span className={[styles.cardGroup, className].filter(Boolean).join(' ')} aria-hidden="true">
      <span className={styles.cardRow}>
        <SkeletonAvatar size="md" />
        <span className={styles.cardRowText}>
          <Skeleton height="0.75rem" width="40%" />
          <Skeleton height="0.75rem" width="65%" />
        </span>
      </span>
      <SkeletonText lines={2} />
    </span>
  );
}
