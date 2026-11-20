import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BookOpen, X } from 'lucide-react';
import {
  useEscapeKey,
  useFocusTrap,
  useOutsideClick,
  usePortal,
  useRestoreFocus,
  useScrollLock,
} from '../../shared/hooks';
import { IconButton } from '../../shared/ui/IconButton';
import { SidebarNav } from '../app-sidebar';
import styles from './MobileNavDrawer.module.css';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The same navigation reusable behavior as `Modal` (portal, focus trap,
 * scroll lock, Escape/outside-click dismissal, focus restoration to the
 * trigger) via the same shared hooks — but not `<Modal>` itself, since a
 * side drawer's layout, animation direction, and "title" (the brand, not
 * a dialog heading) don't match a centered dialog.
 */
export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const portalNode = usePortal();
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(drawerRef, isOpen);
  useRestoreFocus(isOpen);
  useScrollLock(isOpen);
  useEscapeKey(onClose, isOpen);
  useOutsideClick([drawerRef], onClose, isOpen);

  if (!isOpen || !portalNode) return null;

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.drawer}
      >
        <div className={styles.header}>
          <Link to="/dashboard" className={styles.brand} onClick={onClose}>
            <BookOpen className={styles.brandIcon} aria-hidden="true" />
            <span id={titleId} className={styles.brandWordmark}>
              Academy Library
            </span>
          </Link>
          <IconButton
            icon={<X aria-hidden="true" />}
            label="Close navigation"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
        <div className={styles.navScroll}>
          <SidebarNav onNavigate={onClose} />
        </div>
      </div>
    </div>,
    portalNode,
  );
}
