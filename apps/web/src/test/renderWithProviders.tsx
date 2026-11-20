import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  MemoryRouter,
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { ToastProvider } from '../shared/ui/Toast';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // `retry: false` is the default most hooks get — hooks that set
      // their own policy (e.g. `shouldRetryTransientFailure`) override
      // this per-query, since TanStack Query always prefers an explicit
      // per-query option over the client default. Those hooks don't set
      // their own `retryDelay`, though, so this `retryDelay: 0` still
      // applies even then — it's what keeps a retry test from waiting
      // out real exponential backoff (production's `app/queryClient.ts`
      // is a separate `QueryClient` and keeps the real backoff).
      queries: { retry: false, retryDelay: 0, gcTime: 0 },
    },
  });
}

export interface RenderWithProvidersOptions {
  route?: string;
  queryClient?: QueryClient;
}

/**
 * TanStack Query + `ToastProvider` + a classic (non-data) router —
 * enough for any component under test that only uses
 * `useSearchParams`/`useParams`/`useNavigate`, none of which require a
 * real data router (unlike `useMatches`/`useRouteError` — see
 * docs/architecture/decisions.md's "Testing strategy"). `ToastProvider`
 * is included because `RegisterPage` (Task 05C.1) calls `useToast()` —
 * harmless for every other consumer that doesn't.
 */
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { route = '/', queryClient = createTestQueryClient() } = options;

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

export interface RenderWithDataRouterOptions {
  route?: string;
  queryClient?: QueryClient;
}

/**
 * Like `renderWithProviders`, but with a real data router
 * (`createMemoryRouter`) instead of the classic `<MemoryRouter>` — needed
 * for anything using `useBlocker` (Task 05D's unsaved-changes guard),
 * which throws outside a data router context. `createBrowserRouter`
 * can't be mounted under this project's jsdom setup (see
 * docs/architecture/decisions.md, "Testing strategy") because its
 * `.initialize()` constructs a `Request`/`AbortSignal` jsdom's polyfill
 * rejects — `createMemoryRouter` doesn't hit that path and works fine
 * here, confirmed empirically before relying on it.
 */
export function renderWithDataRouter(
  routes: RouteObject[],
  options: RenderWithDataRouterOptions = {},
) {
  const { route = '/', queryClient = createTestQueryClient() } = options;
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
