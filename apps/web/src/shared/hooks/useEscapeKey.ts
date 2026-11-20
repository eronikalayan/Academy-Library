import { useEffect, useRef } from 'react';

/** Calls `onEscape` when the Escape key is pressed while `active`. */
export function useEscapeKey(onEscape: () => void, active = true): void {
  const callbackRef = useRef(onEscape);
  callbackRef.current = onEscape;

  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') callbackRef.current();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active]);
}
