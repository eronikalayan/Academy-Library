import { useLayoutEffect, useRef } from 'react';

/**
 * Remembers whatever element had focus right before `active` became
 * true, and restores focus to it once `active` becomes false again (e.g.
 * returning focus to the button that opened a modal or menu).
 *
 * Uses `useLayoutEffect`, not `useEffect`: the capture has to win a race
 * against other effects (e.g. a focus trap) that move focus *into* the
 * newly-opened content. All layout effects across the tree run before any
 * passive effect, so this reliably captures the real trigger regardless
 * of where those other hooks are called relative to this one.
 */
export function useRestoreFocus(active: boolean): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (active) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      return;
    }

    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
  }, [active]);
}
