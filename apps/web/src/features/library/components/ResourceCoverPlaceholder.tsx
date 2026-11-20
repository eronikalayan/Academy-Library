import type { ResourceType } from '@academy-library/contracts';
import { RESOURCE_TYPE_META } from '../resourceTypeMeta';
import styles from './ResourceCoverPlaceholder.module.css';

export interface ResourceCoverPlaceholderProps {
  type: ResourceType;
  className?: string;
}

/**
 * The well-designed CSS fallback every resource card falls back to —
 * fixture resources never carry a real `coverImageUrl` (see
 * docs/domain/resources.md), so this is what renders for every card
 * today, not an edge case. A soft accent tint plus the resource type's
 * icon, rather than per-type rainbow-coding, to stay within the "premium
 * but restrained" visual language.
 */
export function ResourceCoverPlaceholder({ type, className }: ResourceCoverPlaceholderProps) {
  const { icon: Icon } = RESOURCE_TYPE_META[type];

  return (
    <div className={[styles.placeholder, className].filter(Boolean).join(' ')} aria-hidden="true">
      <Icon className={styles.icon} aria-hidden="true" />
    </div>
  );
}
