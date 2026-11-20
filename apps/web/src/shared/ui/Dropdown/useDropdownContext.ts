import { useContext } from 'react';
import { DropdownContext, type DropdownContextValue } from './DropdownContext';

export function useDropdownContext(): DropdownContextValue {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown.* parts must be rendered within a <Dropdown>.');
  }
  return context;
}
