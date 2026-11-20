import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { PublicUser } from '@academy-library/contracts';
import { requireRole } from '../src/modules/auth/auth.middleware.js';
import { allOf, anyOf, authorize, hasRole, ownedBy } from '../src/modules/auth/policy.js';

function makeUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Test User',
    role: 'STUDENT',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Minimal fakes — `requireRole` only ever reads `req.authUser` and calls
 * `next`, so a real Express request/response isn't needed to test its
 * decision logic in isolation (the DB-backed session resolution it sits
 * on top of is already covered end-to-end by tests/auth.routes.test.ts's
 * /me tests). Typed as a plain `(err?: unknown) => void` rather than
 * `vi.fn<NextFunction>()` — Express's real `NextFunction` type has an
 * internal-use-only `'router'` deferral overload that doesn't survive
 * being wrapped in a mock's type; `requireRole` never calls it with
 * that value, so the cast at each call site is a test-only shape
 * accommodation, not a production-code unsafe cast.
 */
function makeNext() {
  return vi.fn<(err?: unknown) => void>();
}

describe('requireRole middleware', () => {
  it('calls next() with no error when the user has an allowed role', () => {
    const req = { authUser: makeUser({ role: 'ADMIN' }) } as Request;
    const next = makeNext();

    requireRole('ADMIN', 'LECTURER')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() with a 403 AppError when the user has a disallowed role', () => {
    const req = { authUser: makeUser({ role: 'STUDENT' }) } as Request;
    const next = makeNext();

    requireRole('ADMIN', 'LECTURER')(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    expect(error).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('calls next() with a 401 AppError when there is no authenticated user at all', () => {
    const req = {} as Request;
    const next = makeNext();

    requireRole('ADMIN')(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    expect(error).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });
});

interface FakeResource {
  ownerId: string;
}

describe('policy helpers', () => {
  it('hasRole allows exactly the listed roles', () => {
    const policy = hasRole('ADMIN', 'LECTURER');

    expect(policy(makeUser({ role: 'ADMIN' }), undefined)).toBe(true);
    expect(policy(makeUser({ role: 'LECTURER' }), undefined)).toBe(true);
    expect(policy(makeUser({ role: 'STUDENT' }), undefined)).toBe(false);
  });

  it('ownedBy allows only the matching owner', () => {
    const policy = ownedBy<FakeResource>();
    const owner = makeUser({ id: 'owner-1' });
    const someoneElse = makeUser({ id: 'owner-2' });
    const resource: FakeResource = { ownerId: 'owner-1' };

    expect(policy(owner, resource)).toBe(true);
    expect(policy(someoneElse, resource)).toBe(false);
  });

  it('anyOf allows if at least one policy allows (owner OR admin)', () => {
    const policy = anyOf<FakeResource>(ownedBy(), hasRole('ADMIN'));
    const resource: FakeResource = { ownerId: 'owner-1' };

    expect(policy(makeUser({ id: 'owner-1', role: 'STUDENT' }), resource)).toBe(true);
    expect(policy(makeUser({ id: 'someone-else', role: 'ADMIN' }), resource)).toBe(true);
    expect(policy(makeUser({ id: 'someone-else', role: 'STUDENT' }), resource)).toBe(false);
  });

  it('allOf requires every policy to allow', () => {
    const policy = allOf<FakeResource>(ownedBy(), hasRole('LECTURER'));
    const resource: FakeResource = { ownerId: 'owner-1' };

    expect(policy(makeUser({ id: 'owner-1', role: 'LECTURER' }), resource)).toBe(true);
    expect(policy(makeUser({ id: 'owner-1', role: 'STUDENT' }), resource)).toBe(false);
    expect(policy(makeUser({ id: 'someone-else', role: 'LECTURER' }), resource)).toBe(false);
  });

  it('authorize throws a 403 AppError when the policy denies', () => {
    const policy = hasRole('ADMIN');
    let caught: unknown;

    try {
      authorize(policy, makeUser({ role: 'STUDENT' }), undefined);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('authorize does not throw when the policy allows', () => {
    const policy = hasRole('ADMIN');

    expect(() => authorize(policy, makeUser({ role: 'ADMIN' }), undefined)).not.toThrow();
  });
});
