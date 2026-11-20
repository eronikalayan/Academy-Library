import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers the `COOKIE_SAME_SITE` cross-origin escape hatch added in Task
 * 08 (see docs/architecture/authentication.md, "Cookie policy" /
 * "Cross-origin deployment"). `BASE_COOKIE_OPTIONS` is computed once at
 * module load from `env`/`cookieSameSite`, so exercising more than one
 * combination means mutating `process.env` and forcing a fresh module
 * graph via `vi.resetModules()` + a dynamic `import()` for each case —
 * the same approach `tests/registrationPolicy.test.ts` uses for the
 * sibling env-derived security flag it tests.
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE;

function setEnv(overrides: { NODE_ENV?: string; COOKIE_SAME_SITE?: string }): void {
  if (overrides.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = overrides.NODE_ENV;

  if (overrides.COOKIE_SAME_SITE === undefined) delete process.env.COOKIE_SAME_SITE;
  else process.env.COOKIE_SAME_SITE = overrides.COOKIE_SAME_SITE;
}

afterEach(() => {
  setEnv({ NODE_ENV: ORIGINAL_NODE_ENV, COOKIE_SAME_SITE: ORIGINAL_COOKIE_SAME_SITE });
  vi.resetModules();
});

async function loadCookieOptions(overrides: { NODE_ENV?: string; COOKIE_SAME_SITE?: string }) {
  vi.resetModules();
  setEnv(overrides);
  const mod = await import('../src/lib/cookies.js');
  return mod.BASE_COOKIE_OPTIONS;
}

describe('BASE_COOKIE_OPTIONS — SameSite/Secure derivation', () => {
  it('defaults to SameSite=Lax, Secure=false outside production, unchanged from before this flag existed', async () => {
    const options = await loadCookieOptions({ NODE_ENV: 'development' });
    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(false);
  });

  it('defaults to SameSite=Lax, Secure=true in production, unchanged from before this flag existed', async () => {
    const options = await loadCookieOptions({ NODE_ENV: 'production' });
    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(true);
  });

  it('COOKIE_SAME_SITE=none forces Secure=true even outside production — SameSite=None without Secure is rejected by browsers', async () => {
    const options = await loadCookieOptions({
      NODE_ENV: 'development',
      COOKIE_SAME_SITE: 'none',
    });
    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
  });

  it('COOKIE_SAME_SITE=strict leaves Secure tied to NODE_ENV as usual', async () => {
    const options = await loadCookieOptions({
      NODE_ENV: 'development',
      COOKIE_SAME_SITE: 'strict',
    });
    expect(options.sameSite).toBe('strict');
    expect(options.secure).toBe(false);
  });

  it('httpOnly and path are always set regardless of SameSite', async () => {
    const options = await loadCookieOptions({ NODE_ENV: 'test', COOKIE_SAME_SITE: 'none' });
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
  });
});
