import { useEffect, useState } from 'react';

/** Returns `value`, delayed by `delayMs` of inactivity — used by the
 * Library Explorer's search field so typing doesn't re-query on every
 * keystroke. */
export function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}
