import { useState } from 'react';
import { Avatar } from '../../../shared/ui/Avatar';
import { Switch } from '../../../shared/ui/Switch';
import { Skeleton, SkeletonAvatar, SkeletonCard, SkeletonText } from '../../../shared/ui/Skeleton';
import { Section } from '../Section';
import styles from './SkeletonsSection.module.css';

export function SkeletonsSection() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Section
      id="skeletons"
      title="Skeletons"
      description="Text, avatar, card, and generic rectangular placeholders. The shimmer respects reduced-motion."
    >
      <Switch
        label="Simulate loading"
        checked={isLoading}
        onChange={(event) => setIsLoading(event.target.checked)}
      />

      <div className={styles.grid}>
        <div className={styles.cell}>
          {isLoading ? (
            <SkeletonText lines={3} />
          ) : (
            <p className={styles.loadedText}>
              Three lines of real body text now that loading has finished, demonstrating the swap.
            </p>
          )}
        </div>

        <div className={styles.cell}>
          {isLoading ? <SkeletonAvatar size="lg" /> : <Avatar name="Jordan Lee" size="lg" />}
        </div>

        <div className={styles.cell}>
          {isLoading ? (
            <SkeletonCard />
          ) : (
            <p className={styles.loadedText}>Jordan Lee — Contributed 8 resources this month.</p>
          )}
        </div>

        <div className={styles.cell}>
          <Skeleton height="120px" radius="lg" />
        </div>
      </div>
    </Section>
  );
}
