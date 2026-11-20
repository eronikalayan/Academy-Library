import { useCallback, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TabsContext } from './TabsContext';

export interface TabsProps {
  /** Initial selected tab value when uncontrolled. */
  defaultValue: string;
  /** Selected tab value, for controlled usage. */
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const idPrefix = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;

  const setSelectedValue = useCallback(
    (next: string) => {
      setInternalValue(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  const contextValue = useMemo(
    () => ({ selectedValue, setSelectedValue, idPrefix }),
    [selectedValue, setSelectedValue, idPrefix],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}
