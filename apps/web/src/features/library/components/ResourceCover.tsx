import { useState } from 'react';
import type { ResourceType } from '@academy-library/contracts';
import { ResourceCoverPlaceholder } from './ResourceCoverPlaceholder';
import styles from './ResourceCover.module.css';

export interface ResourceCoverProps {
  type: ResourceType;
  coverImageUrl?: string | null;
  className?: string;
}

/**
 * Renders a real cover image when one is present, falling back to the CSS
 * placeholder both when there isn't one and when the image fails to load
 * — the app's layout never depends on an external image actually
 * resolving (see docs/domain/resources.md).
 */
export function ResourceCover({ type, coverImageUrl, className }: ResourceCoverProps) {
  const [failedToLoad, setFailedToLoad] = useState(false);
  const canShowImage = Boolean(coverImageUrl) && !failedToLoad;

  return (
    <div className={[styles.frame, className].filter(Boolean).join(' ')}>
      {canShowImage ? (
        <img
          src={coverImageUrl ?? undefined}
          alt=""
          className={styles.image}
          onError={() => setFailedToLoad(true)}
        />
      ) : (
        <ResourceCoverPlaceholder type={type} />
      )}
    </div>
  );
}
