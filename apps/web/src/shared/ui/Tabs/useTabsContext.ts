import { useContext } from 'react';
import { TabsContext, type TabsContextValue } from './TabsContext';

export function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab and TabPanel must be rendered within a <Tabs> component.');
  }
  return context;
}
