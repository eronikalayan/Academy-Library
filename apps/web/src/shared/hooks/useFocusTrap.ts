import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Keeps keyboard focus cycling within `containerRef` while `active`:
 * focuses the first focusable element on activation, and wraps Tab /
 * Shift+Tab at the container's edges instead of letting focus escape to
 * the rest of the page.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const focusable = getFocusable(container);
    (focusable[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Tab' || !container) return;

      const elements = getFocusable(container);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const current = document.activeElement;
      const currentIsInside = current instanceof Node && container.contains(current);

      if (event.shiftKey) {
        if (!currentIsInside || current === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (!currentIsInside || current === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}
