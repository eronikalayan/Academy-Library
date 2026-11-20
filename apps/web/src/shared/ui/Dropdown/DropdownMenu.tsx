import { useEffect } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useDropdownContext } from './useDropdownContext';
import styles from './Dropdown.module.css';

export interface DropdownMenuProps {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
}

function getItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
}

export function DropdownMenu({ children, className, align = 'start' }: DropdownMenuProps) {
  const { isOpen, close, menuRef, idPrefix } = useDropdownContext();

  useEffect(() => {
    if (!isOpen) return;
    getItems(menuRef.current)[0]?.focus();
  }, [isOpen, menuRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Tab') {
      close();
      return;
    }

    const items = getItems(menuRef.current);
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      id={`${idPrefix}-menu`}
      role="menu"
      aria-labelledby={`${idPrefix}-trigger`}
      className={[styles.menu, styles[align], className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
