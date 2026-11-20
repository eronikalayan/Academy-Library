import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { server } from './mswServer';

// vitest.config.ts doesn't enable `test.globals`, so React Testing
// Library's own auto-cleanup (which only self-registers against a global
// `afterEach`) never fires — without this, every test in a file renders
// into the same document without unmounting the previous one.
afterEach(() => {
  cleanup();
});

// One MSW server for every test file. `onUnhandledRequest: 'error'` is
// deliberate — a test that forgets to mock an endpoint it actually
// calls should fail loudly, not silently hit (or silently fail to
// hit) a real network. Handlers reset after each test so one test's
// `server.use(...)` override never leaks into the next.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });

  // Node 24+'s native `fetch` validates a `RequestInit.signal` against
  // its own internal `AbortSignal` implementation — but Vitest's jsdom
  // environment installs jsdom's own `AbortController`/`AbortSignal`
  // polyfill as the global one, and a signal created through it fails
  // that check with "Expected signal to be an instance of AbortSignal."
  // (a tracked Vitest/jsdom incompatibility, fixed in Vitest 4:
  // https://github.com/vitest-dev/vitest/issues/8374 — this project is
  // still on Vitest 2, pinned by `@vitest/mocker`'s `msw@^2.4.9` peer
  // range). This app deliberately threads a TanStack Query-owned
  // `AbortSignal` all the way to `fetch` (see `shared/api/httpClient.ts`)
  // so real browsers can cancel superseded/unmounted requests — there's
  // only one realm in a real browser, so this mismatch can't happen
  // there; it's purely an artifact of this Node/jsdom test harness.
  // Stripping the signal here, after MSW has installed its own fetch
  // interceptor, means every call still reaches MSW's matching logic
  // (where the incompatible signal would otherwise blow up before MSW
  // even gets to mock or pass it through) — just without a signal MSW
  // never had to honor in a test in the first place.
  const interceptedFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (init && 'signal' in init) {
      const { signal: _signal, ...rest } = init;
      return interceptedFetch(input, rest);
    }
    return interceptedFetch(input, init);
  };

  // Same incompatibility, a second call site: react-router's data router
  // (`createMemoryRouter`, used by `useBlocker` tests — Task 05D)
  // constructs its own `new Request(url, { signal })` internally on
  // every navigation attempt (`startNavigation` →
  // `createClientSideRequest`), using an `AbortController` created in
  // this same jsdom realm — so it hits the identical jsdom-polyfill-vs.
  // -undici mismatch as above, independent of this app's own `fetch`
  // wrapper (`shared/api/httpClient.ts`) entirely. Patching the global
  // `Request` constructor the same way, for the same reason, documented
  // in the same place rather than spread across call sites.
  const OriginalRequest = globalThis.Request;
  globalThis.Request = class extends OriginalRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init && 'signal' in init) {
        const { signal: _signal, ...rest } = init;
        super(input, rest);
      } else {
        super(input, init);
      }
    }
  };
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// This jsdom setup doesn't give components a fully working `localStorage`
// (methods exist but aren't callable) — swap in a minimal, reliable
// in-memory implementation rather than depend on jsdom's.
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// jsdom doesn't implement `window.matchMedia`, used by ThemeProvider to
// read the `prefers-color-scheme` system preference.
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
  configurable: true,
});
