import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('formats under an hour as minutes only', () => {
    expect(formatDuration(1980)).toBe('33m');
  });

  it('formats an exact hour with no leftover minutes', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  it('formats hours and minutes together', () => {
    expect(formatDuration(4500)).toBe('1h 15m');
  });

  it('rounds to the nearest minute', () => {
    expect(formatDuration(1830)).toBe('31m');
  });
});
