import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Lock, X } from 'lucide-react';
import type { CollectionResourceItem } from '@academy-library/contracts';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import { IconButton } from '../../../shared/ui/IconButton';
import { RESOURCE_TYPE_META } from '../../library/resourceTypeMeta';
import styles from './CollectionResourceRow.module.css';

export interface CollectionResourceRowProps {
  item: CollectionResourceItem;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  isBusy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

/**
 * Up/Down buttons, not drag-and-drop — a deliberate scope choice (the
 * task brief's backend-side explicitly rules out implementing
 * drag-and-drop, and carrying that same restraint into the frontend
 * avoids a new DnD library dependency for a feature this task doesn't
 * require). Each click sends the *entire* reordered list via
 * `PATCH .../resources/order` (see
 * `CollectionDetailsPage`'s `moveItem`), matching the real endpoint's
 * own "whole order, not a single-item delta" contract.
 */
export function CollectionResourceRow({
  item,
  canEdit,
  isFirst,
  isLast,
  isBusy,
  onMoveUp,
  onMoveDown,
  onRemove,
}: CollectionResourceRowProps) {
  const typeMeta = RESOURCE_TYPE_META[item.resource.type];
  const TypeIcon = typeMeta.icon;

  return (
    <Card padding="sm" className={styles.row}>
      <Link to={`/library/${item.resource.id}`} className={styles.info}>
        <div className={styles.metaRow}>
          <Badge icon={<TypeIcon aria-hidden="true" />}>{typeMeta.label}</Badge>
          {item.resource.visibility === 'RESTRICTED' && (
            <Badge variant="neutral" icon={<Lock aria-hidden="true" />}>
              Restricted
            </Badge>
          )}
        </div>
        <p className={styles.title}>{item.resource.title}</p>
      </Link>
      {canEdit && (
        <div className={styles.actions}>
          <IconButton
            icon={<ArrowUp aria-hidden="true" />}
            label={`Move "${item.resource.title}" up`}
            size="sm"
            variant="ghost"
            disabled={isFirst || isBusy}
            onClick={onMoveUp}
          />
          <IconButton
            icon={<ArrowDown aria-hidden="true" />}
            label={`Move "${item.resource.title}" down`}
            size="sm"
            variant="ghost"
            disabled={isLast || isBusy}
            onClick={onMoveDown}
          />
          <IconButton
            icon={<X aria-hidden="true" />}
            label={`Remove "${item.resource.title}" from this collection`}
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={onRemove}
          />
        </div>
      )}
    </Card>
  );
}
