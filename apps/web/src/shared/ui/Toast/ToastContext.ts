import { createContext } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms. Defaults to 5000. */
  duration?: number;
}

export interface ToastContextValue {
  /** Queues a toast and returns its id (for manual dismissal). */
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
