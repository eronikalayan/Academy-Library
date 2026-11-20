import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Calls `onOutsideClick` when a pointer-down lands outside every element
 * referenced in `refs` (e.g. both a trigger button and a portaled menu).
 * Reads the latest `refs`/`onOutsideClick` via ref mirrors so the listener
 * is attached once per `active` toggle rather than on every render.
 */
export function useOutsideClick(
  refs: Array<RefObject<HTMLElement>>,
  onOutsideClick: () => void,
  active = true,
): void {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const callbackRef = useRef(onOutsideClick);
  callbackRef.current = onOutsideClick;

  useEffect(() => {
    if (!active) return;

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      const isInside = refsRef.current.some((ref) => ref.current?.contains(target));
      if (!isInside) callbackRef.current();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [active]);
}
