import { createContext } from 'react';

export interface TabsContextValue {
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  idPrefix: string;
}

export const TabsContext = createContext<TabsContextValue | null>(null);
