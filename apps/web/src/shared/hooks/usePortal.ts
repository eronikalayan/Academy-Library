import { useEffect, useState } from 'react';

/**
 * Creates a dedicated DOM node appended to `document.body` for the
 * lifetime of the calling component, for use with `createPortal`. Each
 * call gets its own node (no shared container), which keeps teardown
 * simple and avoids lifecycle races between unrelated overlays.
 */
export function usePortal(): HTMLElement | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement('div');
    el.dataset.portal = 'academy-library';
    document.body.appendChild(el);
    setContainer(el);

    return () => {
      document.body.removeChild(el);
    };
  }, []);

  return container;
}
