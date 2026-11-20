import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ApiErrorResponseSchema, AuthResponseSchema } from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createSession } from '../src/modules/auth/session.service.js';
import { resetAllTables } from './helpers/db.js';
import { createTestClient, postWithCsrf } from './helpers/testClient.js';

const app = createApp();

/**
 * Expected, benign console noise from this file: Prisma logs a
 * `prisma:error` line (its own internal logging, separate from this
 * app's pino logger) whenever `validateSessionToken`'s fire-and-forget
 * `lastUsedAt` update (session.service.ts) loses a race against this
 * file's aggressive per-test `resetAuthTables()` cleanup — the update
 * fires for a session row a *later* test's `beforeEach` has already
 * deleted by the time it actually runs. It's caught (see the `.catch`
 * there) and never fails a request or a test; this is purely a test's
 * artificially fast table-wiping outrunning a best-effort background
 * write that production never triggers this way.
 */

/** `supertest`'s `response.body` is typed `any` — parsing it through the
 * real contract schema on every assertion both satisfies strict linting
 * without a cast and double-checks the response actually conforms to
 * what `@academy-library/contracts` promises, not just what this one
 * test expects. */
function asAuthResponse(body: unknown) {
  return AuthResponseSchema.parse(body);
}
function asApiError(body: unknown) {
  return ApiErrorResponseSchema.parse(body);
}

/** `PublicUserSchema` isn't `.strict()` (reads are deliberately
 * tolerant of forward-compatible extra fields — see
 * packages/contracts/src/auth.ts), so parsing a response through it
 * would silently *strip* an accidental `passwordHash` leak rather than
 * surface it. This checks the raw body directly instead, which is the
 * only way such a leak would actually be caught. */
function hasLeakedPasswordHash(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || !('user' in body)) return false;
  const user = body.user;
  return typeof user === 'object' && user !== null && 'passwordHash' in user;
}

// `resetAllTables`, not `resetAuthTables` — this file only ever writes
// to the auth tables itself, but Task 05B's `resources.routes.test.ts`
// now also runs against this same real database, and `Resource.ownerId`
// is an `onDelete: Restrict` foreign key (see schema.prisma): a leftover
// resource from a test in that file — created in its own `beforeEach`,
// never torn down after its *last* test — would block `user.deleteMany()`
// here with a foreign key violation. Every file that resets user-adjacent
// tables needs the full reset now, regardless of which one runs last.
beforeEach(async () => {
  await resetAllTables();
});

// Resets tables again on the way out, not just `prisma.$disconnect()` —
// `beforeEach` only cleans up *before* the next test in *this* file, so
// without this, whichever DB-touching file Vitest happens to run last
// (file order isn't fixed across runs — see docs/development.md, "Test
// database lifecycle") leaves its final test's rows sitting in the
// shared test database indefinitely, visible to the next `pnpm test`
// run's first test, a Playwright run, or a developer poking at the
// database directly. Task 05D — the originally-reported symptom
// (leftover Course/Group rows) traced to exactly this gap.
afterAll(async () => {
  await resetAllTables();
  await prisma.$disconnect();
});

const VALID_REGISTRATION = {
  email: 'alice@example.com',
  password: 'correct-horse-battery',
  displayName: 'Alice',
};

describe('POST /api/v1/auth/register', () => {
  it('registers a new STUDENT account', async () => {
    const client = createTestClient(app);

    const response = await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);

    expect(response.status).toBe(201);
    expect(asAuthResponse(response.body).user).toMatchObject({
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'STUDENT',
      status: 'ACTIVE',
    });
    expect(hasLeakedPasswordHash(response.body)).toBe(false);

    const stored = await prisma.user.findFirst({ where: { email: 'alice@example.com' } });
    expect(stored).not.toBeNull();
    // Confirms the real Argon2id hashing path ran, not a shortcut.
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    const client = createTestClient(app);
    await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);

    const response = await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);

    expect(response.status).toBe(409);
  });

  it('rejects a duplicate email that only differs by case', async () => {
    const client = createTestClient(app);
    await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);

    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      ...VALID_REGISTRATION,
      email: 'ALICE@EXAMPLE.COM',
    });

    expect(response.status).toBe(409);
    const count = await prisma.user.count();
    expect(count).toBe(1);
  });

  it('rejects an invalid payload (password too short) with 400', async () => {
    const client = createTestClient(app);

    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      ...VALID_REGISTRATION,
      password: 'short',
    });

    expect(response.status).toBe(400);
    expect(asApiError(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid payload (malformed email) with 400', async () => {
    const client = createTestClient(app);

    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      ...VALID_REGISTRATION,
      email: 'not-an-email',
    });

    expect(response.status).toBe(400);
  });

  it('rejects a missing displayName with 400', async () => {
    const client = createTestClient(app);
    const { displayName: _displayName, ...withoutDisplayName } = VALID_REGISTRATION;

    const response = await postWithCsrf(client, '/api/v1/auth/register', withoutDisplayName);

    expect(response.status).toBe(400);
  });

  it('rejects an attempt to register with an elevated role (privilege escalation attempt)', async () => {
    const client = createTestClient(app);

    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      ...VALID_REGISTRATION,
      role: 'ADMIN',
    });

    expect(response.status).toBe(400);
    const stored = await prisma.user.findFirst({ where: { email: 'alice@example.com' } });
    expect(stored).toBeNull();
  });

  it('rejects an attempt to register as pre-ACTIVE/pre-DISABLED status', async () => {
    const client = createTestClient(app);

    const response = await postWithCsrf(client, '/api/v1/auth/register', {
      ...VALID_REGISTRATION,
      status: 'ACTIVE',
    });

    expect(response.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  async function registerAlice(client: ReturnType<typeof createTestClient>): Promise<void> {
    const response = await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);
    expect(response.status).toBe(201);
  }

  it('logs in with correct credentials and sets a session cookie', async () => {
    const registerClient = createTestClient(app);
    await registerAlice(registerClient);

    const loginClient = createTestClient(app);
    const response = await postWithCsrf(loginClient, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });

    expect(response.status).toBe(200);
    expect(asAuthResponse(response.body).user.email).toBe('alice@example.com');

    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const sessionCookie = (setCookieHeader as unknown as string[]).find((cookie) =>
      cookie.startsWith('academy_session='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).toMatch(/Path=\//i);
    // NODE_ENV is "test" here, not "production" — Secure is correctly
    // absent so the cookie still round-trips over the plain-HTTP test
    // client. See docs/architecture/authentication.md ("Cookie policy").
    expect(sessionCookie).not.toMatch(/Secure/i);
  });

  it('returns the same generic error for an unknown email as for a wrong password', async () => {
    const registerClient = createTestClient(app);
    await registerAlice(registerClient);

    const unknownEmailClient = createTestClient(app);
    const unknownEmailResponse = await postWithCsrf(unknownEmailClient, '/api/v1/auth/login', {
      email: 'nobody@example.com',
      password: 'whatever-password',
    });

    const wrongPasswordClient = createTestClient(app);
    const wrongPasswordResponse = await postWithCsrf(wrongPasswordClient, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'totally-wrong-password',
    });

    expect(unknownEmailResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    expect(asApiError(unknownEmailResponse.body).error.message).toBe(
      asApiError(wrongPasswordResponse.body).error.message,
    );
  });

  it('rejects a disabled account with 403, even with the correct password', async () => {
    const registerClient = createTestClient(app);
    await registerAlice(registerClient);
    await prisma.user.updateMany({
      where: { email: 'alice@example.com' },
      data: { status: 'DISABLED' },
    });

    const loginClient = createTestClient(app);
    const response = await postWithCsrf(loginClient, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });

    expect(response.status).toBe(403);
  });

  it('revokes a pre-existing session cookie before issuing a new one (fixation hygiene)', async () => {
    const client = createTestClient(app);
    await registerAlice(client);

    const firstLogin = await postWithCsrf(client, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });
    expect(firstLogin.status).toBe(200);
    const sessionsAfterFirstLogin = await prisma.session.count();
    expect(sessionsAfterFirstLogin).toBe(1);

    // Same agent/cookie jar — this request still carries the first
    // session's cookie when it logs in again.
    const secondLogin = await postWithCsrf(client, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });
    expect(secondLogin.status).toBe(200);

    // The first session must be gone, not just superseded in the cookie
    // jar — exactly one valid session should exist afterward.
    const sessionsAfterSecondLogin = await prisma.session.count();
    expect(sessionsAfterSecondLogin).toBe(1);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user for an authenticated request', async () => {
    const client = createTestClient(app);
    await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);
    await postWithCsrf(client, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });

    const response = await client.get('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(asAuthResponse(response.body).user.email).toBe('alice@example.com');
    expect(hasLeakedPasswordHash(response.body)).toBe(false);
  });

  it.each(['LECTURER', 'ADMIN'] as const)(
    'reflects a %s account created outside the registration endpoint (e.g. by the dev seed)',
    async (role) => {
      // POST /auth/register can only ever create a STUDENT — the only
      // way this test can get a non-student user is the same way the
      // real seed script does: create it directly. `createSession` is
      // the real session service (not a hand-rolled fake row), so this
      // genuinely exercises the DB → session → middleware → response
      // path for a role the public API itself can never produce.
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}@example.com`,
          passwordHash: 'unused-in-this-test',
          displayName: `Test ${role}`,
          role,
          status: 'ACTIVE',
        },
      });
      const session = await createSession(user.id);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `academy_session=${session.token}`);

      expect(response.status).toBe(200);
      expect(asAuthResponse(response.body).user.role).toBe(role);
    },
  );

  it('returns 401 for an unauthenticated request', async () => {
    const client = createTestClient(app);

    const response = await client.get('/api/v1/auth/me');

    expect(response.status).toBe(401);
  });

  it('returns 401 once the session has expired, and cleans it up', async () => {
    const client = createTestClient(app);
    await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);
    await postWithCsrf(client, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });

    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });

    const response = await client.get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    const remainingSessions = await prisma.session.count();
    expect(remainingSessions).toBe(0);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the current session and clears the cookie', async () => {
    const client = createTestClient(app);
    await postWithCsrf(client, '/api/v1/auth/register', VALID_REGISTRATION);
    await postWithCsrf(client, '/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'correct-horse-battery',
    });
    expect(await prisma.session.count()).toBe(1);

    const logoutResponse = await postWithCsrf(client, '/api/v1/auth/logout');

    expect(logoutResponse.status).toBe(204);
    expect(await prisma.session.count()).toBe(0);

    const meResponse = await client.get('/api/v1/auth/me');
    expect(meResponse.status).toBe(401);
  });

  it('succeeds even when there is no session to revoke', async () => {
    const client = createTestClient(app);

    const response = await postWithCsrf(client, '/api/v1/auth/logout');

    expect(response.status).toBe(204);
  });
});

describe('CSRF and origin protection', () => {
  it('rejects a state-changing request with no CSRF token at all', async () => {
    const client = createTestClient(app);

    const response = await client.post('/api/v1/auth/register').send(VALID_REGISTRATION);

    expect(response.status).toBe(403);
    expect(asApiError(response.body).error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('rejects a state-changing request with a missing Origin header', async () => {
    const client = createTestClient(app);
    const csrfToken = await client.csrfToken();

    // Deliberately not using the client's `.post` helper, which always
    // attaches a valid Origin — this constructs the request by hand to
    // omit it.
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send(VALID_REGISTRATION);

    expect(response.status).toBe(403);
  });

  it('rejects a state-changing request from a disallowed Origin', async () => {
    const client = createTestClient(app);
    const csrfToken = await client.csrfToken();

    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'https://evil.example.com')
      .set('x-csrf-token', csrfToken)
      .send(VALID_REGISTRATION);

    expect(response.status).toBe(403);
  });

  it("rejects a CSRF token that doesn't belong to the request's own cookies", async () => {
    const attacker = createTestClient(app);
    const victim = createTestClient(app);
    const attackerToken = await attacker.csrfToken();
    // The victim establishes its own, separately-scoped, otherwise-valid
    // CSRF cookie pair — this isn't "no cookie at all", it's specifically
    // the wrong token for the cookie that is present.
    await victim.csrfToken();

    const response = await victim
      .post('/api/v1/auth/register')
      .set('x-csrf-token', attackerToken)
      .send(VALID_REGISTRATION);

    expect(response.status).toBe(403);
  });

  it('allows GET /auth/me without a CSRF token (safe method)', async () => {
    const client = createTestClient(app);

    const response = await client.get('/api/v1/auth/me');

    // 401 (unauthenticated), not 403 (CSRF) — proves safe methods are
    // genuinely exempt, not just "happen to pass" for another reason.
    expect(response.status).toBe(401);
  });
});
