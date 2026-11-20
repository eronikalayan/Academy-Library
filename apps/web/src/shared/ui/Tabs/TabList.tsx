import { useRef } from 'react';
import type { HTMLAttributes, KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

export type TabListProps = HTMLAttributes<HTMLDivElement>;

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function TabList({ children, className, onKeyDown, ...rest }: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    onKeyDown?.(event);
    if (!ARROW_KEYS.has(event.key)) return;

    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
    );
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;

    event.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      className={[styles.list, className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}
