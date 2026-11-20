import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  useEscapeKey,
  useFocusTrap,
  useOutsideClick,
  usePortal,
  useRestoreFocus,
  useScrollLock,
} from '../../hooks';
import { IconButton } from '../IconButton';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Clicking the backdrop closes the modal. Defaults to true. */
  closeOnOutsideClick?: boolean;
  closeLabel?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOutsideClick = true,
  closeLabel = 'Close',
}: ModalProps) {
  const portalNode = usePortal();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(dialogRef, isOpen);
  useRestoreFocus(isOpen);
  useScrollLock(isOpen);
  useEscapeKey(onClose, isOpen);
  useOutsideClick([dialogRef], onClose, isOpen && closeOnOutsideClick);

  if (!isOpen || !portalNode) return null;

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={[styles.dialog, styles[size]].filter(Boolean).join(' ')}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton
            icon={<X aria-hidden="true" />}
            label={closeLabel}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    portalNode,
  );
}
