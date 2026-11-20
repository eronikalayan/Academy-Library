import { describe, expect, it } from 'vitest';
import { resolveSafeRedirect } from './safeRedirect';

const FALLBACK = '/dashboard';

describe('resolveSafeRedirect', () => {
  it('accepts a plain same-origin path', () => {
    expect(resolveSafeRedirect('/library/abc', { fallback: FALLBACK })).toBe('/library/abc');
  });

  it('preserves query string and hash on an accepted path', () => {
    expect(resolveSafeRedirect('/library?search=algorithms#top', { fallback: FALLBACK })).toBe(
      '/library?search=algorithms#top',
    );
  });

  it('falls back for null', () => {
    expect(resolveSafeRedirect(null, { fallback: FALLBACK })).toBe(FALLBACK);
  });

  it('falls back for an empty string', () => {
    expect(resolveSafeRedirect('', { fallback: FALLBACK })).toBe(FALLBACK);
  });

  it('rejects a protocol-relative URL (//evil.example.com)', () => {
    expect(resolveSafeRedirect('//evil.example.com', { fallback: FALLBACK })).toBe(FALLBACK);
  });

  it('rejects an absolute external URL', () => {
    expect(resolveSafeRedirect('https://evil.example.com', { fallback: FALLBACK })).toBe(FALLBACK);
  });

  it('rejects a value with no leading slash', () => {
    expect(resolveSafeRedirect('evil.example.com', { fallback: FALLBACK })).toBe(FALLBACK);
  });

  it('rejects a javascript: pseudo-URL', () => {
    expect(resolveSafeRedirect('javascript:alert(1)', { fallback: FALLBACK })).toBe(FALLBACK);
  });

  it('rejects an excluded path (e.g. /login), preventing a redirect loop', () => {
    expect(
      resolveSafeRedirect('/login', { fallback: FALLBACK, excludePaths: ['/login', '/register'] }),
    ).toBe(FALLBACK);
  });

  it('still accepts a non-excluded path when an exclude list is given', () => {
    expect(
      resolveSafeRedirect('/library', {
        fallback: FALLBACK,
        excludePaths: ['/login', '/register'],
      }),
    ).toBe('/library');
  });
});
