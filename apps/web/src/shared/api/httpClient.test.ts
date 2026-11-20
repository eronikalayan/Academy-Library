import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/mswServer';

/**
 * Covers the cross-origin credentials-mode derivation added in Task 08
 * (see docs/architecture/authentication.md, "Cross-origin deployment").
 * `CREDENTIALS_MODE` is computed once at module load from
 * `VITE_API_BASE_URL`, so exercising both cases means stubbing that env
 * var and forcing a fresh module graph via `vi.resetModules()` + a
 * dynamic `import()` — mirroring the pattern
 * `apps/api/tests/registrationPolicy.test.ts`/`cookies.test.ts` use for
 * the equivalent env-derived security config on the backend. Asserting
 * against `request.credentials` on the real intercepted `Request` (MSW,
 * already wired up for this whole suite via `src/test/setup.ts`) proves
 * what `fetch` actually sent, not just that the string-matching regex
 * produced the expected label.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadApiRequest(apiBaseUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', apiBaseUrl);
  const mod = await import('./httpClient');
  return mod.apiRequest;
}

describe('apiRequest credentials mode — derived from VITE_API_BASE_URL', () => {
  it('sends same-origin credentials for the default, relative base URL', async () => {
    let observedCredentials: RequestCredentials | undefined;
    server.use(
      http.get('*/health', ({ request }) => {
        observedCredentials = request.credentials;
        return HttpResponse.json({ ok: true });
      }),
    );
    const apiRequest = await loadApiRequest('/api/v1');

    await apiRequest('/health', (data) => data);

    expect(observedCredentials).toBe('same-origin');
  });

  it('sends include credentials when VITE_API_BASE_URL is an absolute, different-origin URL', async () => {
    let observedCredentials: RequestCredentials | undefined;
    server.use(
      http.get('*/health', ({ request }) => {
        observedCredentials = request.credentials;
        return HttpResponse.json({ ok: true });
      }),
    );
    const apiRequest = await loadApiRequest('https://api.example.com/api/v1');

    await apiRequest('/health', (data) => data);

    expect(observedCredentials).toBe('include');
  });
});
