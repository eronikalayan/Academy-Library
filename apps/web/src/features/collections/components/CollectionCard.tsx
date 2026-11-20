import { Link } from 'react-router-dom';
import { Layers, Lock } from 'lucide-react';
import type { CollectionSummary } from '@academy-library/contracts';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import styles from './CollectionCard.module.css';

export interface CollectionCardProps {
  collection: CollectionSummary;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Card padding="none" interactive className={styles.card}>
      <Link to={`/collections/${collection.id}`} className={styles.link}>
        <div className={styles.cover}>
          <Layers aria-hidden="true" className={styles.coverIcon} />
        </div>
        <div className={styles.body}>
          <div className={styles.metaRow}>
            {collection.visibility === 'RESTRICTED' && (
              <Badge variant="neutral" icon={<Lock aria-hidden="true" />}>
                Restricted
              </Badge>
            )}
            <span className={styles.resourceCount}>
              {collection.resourceCount} resource{collection.resourceCount === 1 ? '' : 's'}
            </span>
          </div>
          <h3 className={styles.title}>{collection.title}</h3>
          <p className={styles.description}>{collection.description}</p>
        </div>
      </Link>
    </Card>
  );
}
