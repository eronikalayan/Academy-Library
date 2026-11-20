import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePortal } from '../../hooks';
import { ToastContext, type ToastOptions } from './ToastContext';
import { ToastItem } from './ToastItem';
import styles from './Toast.module.css';

interface ToastRecord extends ToastOptions {
  id: string;
}

const DEFAULT_DURATION_MS = 5000;

let toastIdCounter = 0;
function createToastId(): string {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}`;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const portalNode = usePortal();
  const timeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = createToastId();
      setToasts((current) => [...current, { ...options, id }]);
      const timeoutId = setTimeout(() => dismissToast(id), options.duration ?? DEFAULT_DURATION_MS);
      timeoutsRef.current.set(id, timeoutId);
      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const contextValue = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {portalNode &&
        createPortal(
          <div
            className={styles.viewport}
            role="region"
            aria-live="polite"
            aria-label="Notifications"
          >
            {toasts.map((toast) => (
              <ToastItem key={toast.id} {...toast} onDismiss={() => dismissToast(toast.id)} />
            ))}
          </div>,
          portalNode,
        )}
    </ToastContext.Provider>
  );
}
