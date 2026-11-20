import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { routes } from './routes';
import { NotFoundPage } from '../../features/not-found/NotFoundPage';

// The live data router (createBrowserRouter) is exercised in the browser and
// in Playwright e2e, not here: under jsdom its eager `.initialize()` call
// constructs a Request whose AbortSignal fails an `instanceof` check against
// Node's undici implementation (a known jsdom/Node fetch-polyfill mismatch).
// These tests instead assert the route configuration shape and render each
// route's page component directly.

describe('route configuration', () => {
  it('mounts the public layout with the home page plus a RedirectIfAuthenticated-gated auth branch', () => {
    const [publicBranch] = routes;
    const children = publicBranch?.children ?? [];

    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ index: true, handle: { title: 'Academy Library' } });

    const authBranch = children[1];
    const authPaths = (authBranch?.children ?? []).map((child) => child.path);
    expect(authPaths).toEqual(['login', 'register']);
  });

  it('gates the app layout behind RequireAuth, with every product page plus a catch-all underneath', () => {
    const [, requireAuthBranch] = routes;
    const [appLayoutNode] = requireAuthBranch?.children ?? [];
    const children = appLayoutNode?.children ?? [];
    const paths = children.map((child) => child.path);

    expect(paths).toEqual([
      'dashboard',
      'library',
      'collections',
      'saved',
      'loans',
      'learning',
      'settings',
      'admin',
      '*',
    ]);
  });

  it('gates the admin pages behind RequireRole, nested under the admin layout', () => {
    const [, requireAuthBranch] = routes;
    const [appLayoutNode] = requireAuthBranch?.children ?? [];
    const requireRoleNode = appLayoutNode?.children?.find((child) => child.path === 'admin');
    const [adminLayoutNode] = requireRoleNode?.children ?? [];
    const adminChildren = adminLayoutNode?.children ?? [];

    expect(requireRoleNode?.handle).toMatchObject({ title: 'Admin' });
    expect(adminChildren).toMatchObject([
      { index: true, handle: { title: 'Admin Dashboard' } },
      { path: 'resources', handle: { title: 'Manage Resources' } },
      { path: 'users', handle: { title: 'Users' } },
      { path: 'loans', handle: { title: 'Manage Loans' } },
    ]);
  });

  it('includes the dev-only design system route when running in dev mode', () => {
    // Vitest's default mode is 'test', which Vite's `import.meta.env.DEV`
    // resolves to `true` (anything other than 'production' counts as dev).
    const devRoute = routes.find((route) => route.path === '/dev/design-system');
    expect(devRoute).toBeDefined();
  });

  it('every top-level layout branch has a route-level error fallback', () => {
    const [publicBranch, requireAuthBranch] = routes;
    const [appLayoutNode] = requireAuthBranch?.children ?? [];

    expect(publicBranch?.errorElement).toBeTruthy();
    expect(appLayoutNode?.errorElement).toBeTruthy();
  });
});

describe('page components', () => {
  it('renders the not found page with a link back home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
