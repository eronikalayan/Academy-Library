import { Link } from 'react-router-dom';
import { Clock, Lock } from 'lucide-react';
import type { ResourceSummary } from '@academy-library/contracts';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import { formatDuration } from '../formatDuration';
import { RESOURCE_DIFFICULTY_META, RESOURCE_TYPE_META } from '../resourceTypeMeta';
import { ResourceCover } from './ResourceCover';
import styles from './ResourceCard.module.css';

export interface ResourceCardProps {
  resource: ResourceSummary;
  /** List mode lays the cover out beside the text instead of above it. */
  variant: 'grid' | 'list';
}

const VISIBLE_TAG_COUNT = 4;

export function ResourceCard({ resource, variant }: ResourceCardProps) {
  const typeMeta = RESOURCE_TYPE_META[resource.type];
  const difficultyMeta = RESOURCE_DIFFICULTY_META[resource.difficulty];
  const TypeIcon = typeMeta.icon;
  const visibleTags = resource.tags.slice(0, VISIBLE_TAG_COUNT);
  const hiddenTagCount = resource.tags.length - visibleTags.length;

  return (
    <Card
      padding="none"
      interactive
      className={[styles.card, variant === 'list' ? styles.list : styles.grid]
        .filter(Boolean)
        .join(' ')}
    >
      <Link to={`/library/${resource.id}`} className={styles.link}>
        <ResourceCover
          type={resource.type}
          coverImageUrl={resource.coverImageUrl}
          className={styles.cover}
        />
        <div className={styles.body}>
          <div className={styles.metaRow}>
            <Badge icon={<TypeIcon aria-hidden="true" />}>{typeMeta.label}</Badge>
            <Badge variant={difficultyMeta.badgeVariant}>{difficultyMeta.label}</Badge>
            {resource.visibility === 'RESTRICTED' && (
              <Badge variant="neutral" icon={<Lock aria-hidden="true" />}>
                Restricted
              </Badge>
            )}
            {resource.durationSeconds != null && (
              <span className={styles.duration}>
                <Clock aria-hidden="true" className={styles.durationIcon} />
                {formatDuration(resource.durationSeconds)}
              </span>
            )}
          </div>
          <h3 className={styles.title}>{resource.title}</h3>
          <p className={styles.creator}>{resource.creator.name}</p>
          <p className={styles.description}>{resource.description}</p>
          {visibleTags.length > 0 && (
            <ul className={styles.tags}>
              {visibleTags.map((tag) => (
                <li key={tag}>
                  <Badge variant="neutral">{tag}</Badge>
                </li>
              ))}
              {hiddenTagCount > 0 && (
                <li>
                  <Badge variant="neutral">+{hiddenTagCount}</Badge>
                </li>
              )}
            </ul>
          )}
        </div>
      </Link>
    </Card>
  );
}
