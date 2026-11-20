import request from 'supertest';
import type { Express } from 'express';

/** Must be one of the API's configured CORS origins (see
 * apps/api/vitest.config.ts / src/config/env.ts's default) — every
 * state-changing test request sets this explicitly, the way a real
 * browser would, since supertest otherwise sends no `Origin` header at
 * all and `validateOrigin` would reject every one of them. */
export const TEST_ORIGIN = 'http://localhost:5173';

export interface TestClient {
  get(path: string): request.Test;
  post(path: string): request.Test;
  patch(path: string): request.Test;
  delete(path: string): request.Test;
  /** Fetches a fresh CSRF token (and, as a side effect, the cookies it's
   * bound to) through this same agent — so a token from one client is
   * never usable through another's cookie jar. */
  csrfToken(): Promise<string>;
}

/** A cookie-jar-carrying client scoped to one `supertest.agent`, so
 * multiple independent "browsers" can be created in the same test (e.g.
 * to prove a CSRF token from one doesn't validate against another's
 * cookies). */
export function createTestClient(app: Express): TestClient {
  const agent = request.agent(app);

  return {
    get: (path: string) => agent.get(path).set('Origin', TEST_ORIGIN),
    post: (path: string) => agent.post(path).set('Origin', TEST_ORIGIN),
    patch: (path: string) => agent.patch(path).set('Origin', TEST_ORIGIN),
    delete: (path: string) => agent.delete(path).set('Origin', TEST_ORIGIN),
    async csrfToken(): Promise<string> {
      const response = await agent.get('/api/v1/auth/csrf-token').set('Origin', TEST_ORIGIN);
      const body = response.body as { csrfToken: string };
      return body.csrfToken;
    },
  };
}

/**
 * Shared by `postWithCsrf`/`patchWithCsrf`/`deleteWithCsrf` below: fetch
 * a CSRF token for this client, *then* construct the request, attach the
 * token, and send `body` if given. The request is deliberately built
 * from `path` here — AFTER the token fetch resolves — rather than
 * accepted as an already-constructed `request.Test` from the caller:
 * `client.csrfToken()` is itself a full round trip through this same
 * `supertest.agent`, which is what sets the fresh `csrf_secret` cookie on
 * the agent's jar in the first place. Building `client.post(path)` (or
 * `patch`/`delete`) any earlier would snapshot that jar *before* the new
 * cookie lands in it, sending the write request without the very cookie
 * the just-fetched token is bound to — a real bug this project hit once
 * already (see git history / Task 05B's completion report) when a
 * refactor took a pre-built request object as a parameter instead.
 */
async function sendWithCsrf(
  client: TestClient,
  method: 'post' | 'patch' | 'delete',
  path: string,
  body?: object,
): Promise<request.Response> {
  const csrfToken = await client.csrfToken();
  const pendingRequest = client[method](path).set('x-csrf-token', csrfToken);
  return body === undefined ? pendingRequest : pendingRequest.send(body);
}

export function postWithCsrf(
  client: TestClient,
  path: string,
  body?: object,
): Promise<request.Response> {
  return sendWithCsrf(client, 'post', path, body);
}

export function patchWithCsrf(
  client: TestClient,
  path: string,
  body?: object,
): Promise<request.Response> {
  return sendWithCsrf(client, 'patch', path, body);
}

export function deleteWithCsrf(client: TestClient, path: string): Promise<request.Response> {
  return sendWithCsrf(client, 'delete', path);
}
