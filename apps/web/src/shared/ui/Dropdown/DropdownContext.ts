import { createContext } from 'react';
import type { RefObject } from 'react';

export interface DropdownContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
  idPrefix: string;
}

export const DropdownContext = createContext<DropdownContextValue | null>(null);
