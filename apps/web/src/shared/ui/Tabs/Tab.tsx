import type { ReactNode } from 'react';
import { useTabsContext } from './useTabsContext';
import styles from './Tabs.module.css';

export interface TabProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, disabled, className }: TabProps) {
  const { selectedValue, setSelectedValue, idPrefix } = useTabsContext();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${idPrefix}-tab-${value}`}
      aria-selected={isSelected}
      aria-controls={`${idPrefix}-panel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      className={[styles.tab, isSelected ? styles.tabSelected : null, className]
        .filter(Boolean)
        .join(' ')}
      onClick={() => setSelectedValue(value)}
    >
      {children}
    </button>
  );
}
