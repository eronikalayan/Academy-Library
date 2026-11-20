import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ApiError } from '../../../shared/api/ApiError';
import { clearCsrfToken } from '../../../shared/api/csrfToken';
import { server } from '../../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../../test/authFixtures';
import {
  csrfTokenHandler,
  duplicateEmailHandler,
  invalidLoginHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
} from '../../../test/mswHandlers';
import { fetchCurrentUser, login, logout, register } from './authApi';

const API_BASE_URL = '/api/v1';

beforeEach(() => {
  // Each test gets a clean CSRF cache — otherwise a token fetched by an
  // earlier test in this file would still be cached and this file's
  // CSRF-specific assertions couldn't observe a fresh fetch happening.
  clearCsrfToken();
});

describe('login', () => {
  it('resolves with the user on success', async () => {
    server.use(csrfTokenHandler, loginHandler(MOCK_STUDENT_USER));

    const result = await login({ email: MOCK_STUDENT_USER.email, password: 'correct-password' });

    expect(result.user).toEqual(MOCK_STUDENT_USER);
  });

  it('throws an ApiError with code UNAUTHORIZED for bad credentials', async () => {
    server.use(csrfTokenHandler, invalidLoginHandler);

    await expect(login({ email: 'nobody@example.com', password: 'wrong' })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('attaches the CSRF token header on the request', async () => {
    let receivedHeader: string | null = null;
    server.use(
      csrfTokenHandler,
      http.post(`${API_BASE_URL}/auth/login`, ({ request }) => {
        receivedHeader = request.headers.get('x-csrf-token');
        return HttpResponse.json({ user: MOCK_STUDENT_USER });
      }),
    );

    await login({ email: MOCK_STUDENT_USER.email, password: 'correct-password' });

    expect(receivedHeader).toBe('test-csrf-token');
  });

  it('clears the cached CSRF token on an INVALID_CSRF_TOKEN response, so the next request fetches a fresh one', async () => {
    let csrfFetchCount = 0;
    server.use(
      http.get(`${API_BASE_URL}/auth/csrf-token`, () => {
        csrfFetchCount += 1;
        return HttpResponse.json({ csrfToken: `token-${csrfFetchCount}` });
      }),
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json(
          { error: { message: 'Invalid or missing CSRF token', code: 'INVALID_CSRF_TOKEN' } },
          { status: 403 },
        ),
      ),
    );

    await expect(
      login({ email: MOCK_STUDENT_USER.email, password: 'correct-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CSRF_TOKEN' });
    expect(csrfFetchCount).toBe(1);

    // A second attempt fetches a brand new token rather than reusing the
    // one that was just rejected.
    await expect(
      login({ email: MOCK_STUDENT_USER.email, password: 'correct-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CSRF_TOKEN' });
    expect(csrfFetchCount).toBe(2);
  });
});

describe('register', () => {
  it('resolves with the created user on success', async () => {
    server.use(csrfTokenHandler, registerHandler(MOCK_STUDENT_USER));

    const result = await register({
      email: MOCK_STUDENT_USER.email,
      password: 'a-long-enough-password',
      displayName: MOCK_STUDENT_USER.displayName,
    });

    expect(result.user).toEqual(MOCK_STUDENT_USER);
  });

  it('throws an ApiError with code CONFLICT for a duplicate email', async () => {
    server.use(csrfTokenHandler, duplicateEmailHandler);

    await expect(
      register({
        email: MOCK_STUDENT_USER.email,
        password: 'a-long-enough-password',
        displayName: 'Someone',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });

  it('rejects an invalid payload before ever making a network request (registration validation)', async () => {
    // No handlers registered at all — if this reached the network,
    // `onUnhandledRequest: 'error'` (test/setup.ts) would fail the test
    // for a different reason than the one being asserted.
    await expect(
      register({ email: 'not-an-email', password: 'short', displayName: '' }),
    ).rejects.toThrow();
  });
});

describe('logout', () => {
  it('resolves on a 204', async () => {
    server.use(csrfTokenHandler, logoutHandler);
    await expect(logout()).resolves.toBeUndefined();
  });
});

describe('fetchCurrentUser', () => {
  it('resolves with the user when a session is active', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    await expect(fetchCurrentUser()).resolves.toEqual(MOCK_STUDENT_USER);
  });

  it('resolves with null (not a thrown error) for an unauthenticated/expired session', async () => {
    server.use(meHandler(null));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it('still throws for a genuine server error, rather than treating it as logged out', async () => {
    server.use(
      http.get(`${API_BASE_URL}/auth/me`, () =>
        HttpResponse.json(
          { error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' } },
          { status: 500 },
        ),
      ),
    );

    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});
