import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useEscapeKey, useOutsideClick, useRestoreFocus } from '../../hooks';
import { DropdownContext } from './DropdownContext';
import styles from './Dropdown.module.css';

export interface DropdownProps {
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Not portaled: the menu is positioned `absolute` relative to this root,
 * which keeps it in natural DOM/tab order right after the trigger
 * (portaling a menu to `document.body` is the more common choice for
 * modals, but it breaks Tab order for simple menus unless you also
 * manage focus redirection on the way out — not worth it here).
 */
export function Dropdown({
  defaultOpen = false,
  isOpen: isOpenProp,
  onOpenChange,
  children,
  className,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isOpenProp ?? internalOpen;
  const idPrefix = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const open = useCallback(() => setOpen(true), [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEscapeKey(close, isOpen);
  useOutsideClick([triggerRef, menuRef], close, isOpen);
  useRestoreFocus(isOpen);

  const contextValue = useMemo(
    () => ({ isOpen, open, close, triggerRef, menuRef, idPrefix }),
    [isOpen, open, close, idPrefix],
  );

  return (
    <DropdownContext.Provider value={contextValue}>
      <div className={[styles.root, className].filter(Boolean).join(' ')}>{children}</div>
    </DropdownContext.Provider>
  );
}
