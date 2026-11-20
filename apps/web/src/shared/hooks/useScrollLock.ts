import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';

/**
 * Locks page scroll while `active`. Reference-counted at module scope so
 * stacked overlays (e.g. a confirm modal opened from within another
 * modal) don't restore scrolling until the last one closes.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [active]);
}
