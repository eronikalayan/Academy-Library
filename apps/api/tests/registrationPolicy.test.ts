import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorResponseSchema } from '@academy-library/contracts';
import { createTestClient, postWithCsrf } from './helpers/testClient.js';

function asApiError(body: unknown) {
  return ApiErrorResponseSchema.parse(body);
}

/**
 * Covers the `REGISTRATION_ENABLED` policy added in Task 08 (see
 * docs/architecture/authentication.md, "Known limitations" — there is no
 * password reset or email verification yet, so public self-registration
 * needs to fail safe on a production deployment that forgets to
 * configure it explicitly).
 *
 * `env.ts`'s `env`/`registrationEnabled` are evaluated once at module
 * load from `process.env`, so exercising more than one combination means
 * mutating `process.env` and forcing a fresh module graph via
 * `vi.resetModules()` + a dynamic `import()` for each case — the same
 * "fresh, isolated instance" approach `tests/rateLimit.test.ts` uses for
 * the sibling piece of auth-adjacent config it tests. `DATABASE_URL`/
 * `CSRF_SECRET` are left as whatever vitest.config.ts's `test.env`
 * already set — only `NODE_ENV`/`REGISTRATION_ENABLED` are varied here.
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_REGISTRATION_ENABLED = process.env.REGISTRATION_ENABLED;

function setEnv(overrides: { NODE_ENV?: string; REGISTRATION_ENABLED?: string }): void {
  if (overrides.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = overrides.NODE_ENV;

  if (overrides.REGISTRATION_ENABLED === undefined) delete process.env.REGISTRATION_ENABLED;
  else process.env.REGISTRATION_ENABLED = overrides.REGISTRATION_ENABLED;
}

afterEach(() => {
  setEnv({ NODE_ENV: ORIGINAL_NODE_ENV, REGISTRATION_ENABLED: ORIGINAL_REGISTRATION_ENABLED });
  vi.resetModules();
});

async function loadRegistrationEnabled(overrides: {
  NODE_ENV?: string;
  REGISTRATION_ENABLED?: string;
}): Promise<boolean> {
  vi.resetModules();
  setEnv(overrides);
  const mod = await import('../src/config/env.js');
  return mod.registrationEnabled;
}

describe('registrationEnabled — safe-by-default registration policy', () => {
  it('defaults to enabled in development and test, unchanged from before this flag existed', async () => {
    expect(await loadRegistrationEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(await loadRegistrationEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it('defaults to disabled in production — fails safe, not open', async () => {
    expect(await loadRegistrationEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('an explicit REGISTRATION_ENABLED=true overrides the production default', async () => {
    expect(
      await loadRegistrationEnabled({ NODE_ENV: 'production', REGISTRATION_ENABLED: 'true' }),
    ).toBe(true);
  });

  it('an explicit REGISTRATION_ENABLED=false overrides the development default', async () => {
    expect(
      await loadRegistrationEnabled({ NODE_ENV: 'development', REGISTRATION_ENABLED: 'false' }),
    ).toBe(false);
  });

  it('parses the string "false" as false rather than coercing it truthy (the z.coerce.boolean() pitfall)', async () => {
    expect(await loadRegistrationEnabled({ NODE_ENV: 'test', REGISTRATION_ENABLED: 'false' })).toBe(
      false,
    );
  });
});

describe('POST /auth/register — gated by registrationEnabled', () => {
  it('returns 403 with an explanatory message when registration is disabled, without touching the database', async () => {
    vi.resetModules();
    // NODE_ENV stays 'test' here (not 'production') so the session/CSRF
    // cookies this test's own client round-trips stay non-`Secure` —
    // see src/lib/cookies.ts. `registrationEnabled`'s NODE_ENV-driven
    // default is already covered above; this only needs
    // REGISTRATION_ENABLED itself to be false, which the gate reads
    // directly regardless of NODE_ENV.
    setEnv({ NODE_ENV: 'test', REGISTRATION_ENABLED: 'false' });
    const { createApp } = await import('../src/app.js');
    const client = createTestClient(createApp());

    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      email: 'someone@example.com',
      password: 'a-perfectly-fine-password',
      displayName: 'Someone',
    });

    expect(response.status).toBe(403);
    const body = asApiError(response.body);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toMatch(/registration is currently disabled/i);
  });

  it('still parses/validates normally (reaches the handler) when registration is enabled', async () => {
    vi.resetModules();
    setEnv({ NODE_ENV: 'test', REGISTRATION_ENABLED: 'true' });
    const { createApp } = await import('../src/app.js');
    const client = createTestClient(createApp());

    // An intentionally invalid body — short-circuits on Zod validation,
    // not the registration gate, which is the thing actually under test
    // here: a 400 (not a 403) proves the request reached past the gate.
    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      email: 'not-an-email',
      password: 'short',
      displayName: '',
    });

    expect(response.status).toBe(400);
    expect(asApiError(response.body).error.code).toBe('VALIDATION_ERROR');
  });
});
