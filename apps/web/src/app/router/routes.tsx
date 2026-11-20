import type { RouteObject } from 'react-router-dom';
import { RedirectIfAuthenticated } from '../auth/RedirectIfAuthenticated';
import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { AdminLayout } from '../layouts/AdminLayout';
import { AppLayout } from '../layouts/AppLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { RouteErrorFallback } from '../RouteErrorFallback';

export const routes: RouteObject[] = [
  // Pre-authentication shell: the marketing home page (open to anyone)
  // plus /login and /register, gated by RedirectIfAuthenticated so an
  // already-signed-in visitor is sent into the app instead of seeing a
  // sign-in form again.
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        index: true,
        handle: { title: 'Academy Library' },
        lazy: () => import('../../features/home/HomePage').then((m) => ({ Component: m.HomePage })),
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          {
            path: 'login',
            handle: { title: 'Sign in' },
            lazy: () =>
              import('../../features/auth/LoginPage').then((m) => ({ Component: m.LoginPage })),
          },
          {
            path: 'register',
            handle: { title: 'Create account' },
            lazy: () =>
              import('../../features/auth/RegisterPage').then((m) => ({
                Component: m.RegisterPage,
              })),
          },
        ],
      },
    ],
  },
  // Authenticated product shell — gated by RequireAuth, which resolves
  // the real session via GET /api/v1/auth/me (see
  // features/auth/api/useCurrentUser.ts) before rendering anything
  // below it, redirecting to /login otherwise. Role-based nav
  // visibility (shared/config/navigation.ts) remains a display
  // convenience on top of this — the backend session's role is what
  // actually governs access, both here (RequireRole, below, on the
  // admin branch) and on every API call.
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorFallback />,
        children: [
          {
            path: 'dashboard',
            handle: { title: 'Dashboard' },
            lazy: () =>
              import('../../features/dashboard/DashboardPage').then((m) => ({
                Component: m.DashboardPage,
              })),
          },
          {
            path: 'library',
            handle: { title: 'Explore Library' },
            children: [
              {
                index: true,
                lazy: () =>
                  import('../../features/library/LibraryPage').then((m) => ({
                    Component: m.LibraryPage,
                  })),
              },
              {
                // Creation has no per-resource ownership question to
                // resolve (unlike editing, below) — a flat role gate is
                // the whole authorization story, so it's the one place
                // under `/library` that uses `RequireRole` rather than
                // an in-page capability check.
                element: <RequireRole roles={['LECTURER', 'ADMIN']} />,
                children: [
                  {
                    path: 'new',
                    handle: { title: 'Create resource' },
                    lazy: () =>
                      import('../../features/library/CreateResourcePage').then((m) => ({
                        Component: m.CreateResourcePage,
                      })),
                  },
                ],
              },
              {
                path: ':resourceId',
                handle: { title: 'Resource details' },
                lazy: () =>
                  import('../../features/library/ResourceDetailsPage').then((m) => ({
                    Component: m.ResourceDetailsPage,
                  })),
              },
              {
                // Not role-gated here — a signed-in LECTURER may edit
                // *their own* resources but not another's, which only
                // the fetched resource's own `capabilities.canEdit` can
                // answer (see EditResourcePage.tsx's own doc comment).
                // A flat role gate would be both redundant with that
                // check and unable to express it.
                path: ':resourceId/edit',
                handle: { title: 'Edit resource' },
                lazy: () =>
                  import('../../features/library/EditResourcePage').then((m) => ({
                    Component: m.EditResourcePage,
                  })),
              },
            ],
          },
          {
            path: 'collections',
            handle: { title: 'Collections' },
            children: [
              {
                index: true,
                lazy: () =>
                  import('../../features/collections/CollectionsPage').then((m) => ({
                    Component: m.CollectionsPage,
                  })),
              },
              {
                // Same reasoning as `/library/new` — creation has no
                // per-collection ownership question to resolve, so a
                // flat role gate is the whole authorization story.
                element: <RequireRole roles={['LECTURER', 'ADMIN']} />,
                children: [
                  {
                    path: 'new',
                    handle: { title: 'Create collection' },
                    lazy: () =>
                      import('../../features/collections/CreateCollectionPage').then((m) => ({
                        Component: m.CreateCollectionPage,
                      })),
                  },
                ],
              },
              {
                path: ':collectionId',
                handle: { title: 'Collection details' },
                lazy: () =>
                  import('../../features/collections/CollectionDetailsPage').then((m) => ({
                    Component: m.CollectionDetailsPage,
                  })),
              },
              {
                // Not role-gated here — same reasoning as
                // `/library/:resourceId/edit`: a LECTURER may edit
                // *their own* collections but not another's, which
                // only the fetched collection's own
                // `capabilities.canEdit` can answer.
                path: ':collectionId/edit',
                handle: { title: 'Edit collection' },
                lazy: () =>
                  import('../../features/collections/EditCollectionPage').then((m) => ({
                    Component: m.EditCollectionPage,
                  })),
              },
            ],
          },
          {
            path: 'saved',
            handle: { title: 'Saved Resources' },
            lazy: () =>
              import('../../features/saved/SavedPage').then((m) => ({ Component: m.SavedPage })),
          },
          {
            path: 'loans',
            handle: { title: 'Book Loans' },
            lazy: () =>
              import('../../features/loans/LoansPage').then((m) => ({ Component: m.LoansPage })),
          },
          {
            path: 'learning',
            handle: { title: 'My Learning' },
            lazy: () =>
              import('../../features/learning/LearningPage').then((m) => ({
                Component: m.LearningPage,
              })),
          },
          {
            path: 'settings',
            handle: { title: 'Settings' },
            lazy: () =>
              import('../../features/settings/SettingsPage').then((m) => ({
                Component: m.SettingsPage,
              })),
          },
          {
            // One more nesting level than `AppLayout`'s other children:
            // `RequireRole` renders either an inline 403 (see
            // app/auth/RequireRole.tsx) or `<Outlet/>`, with `AdminLayout`
            // only ever reached once a real `ADMIN` session is confirmed.
            path: 'admin',
            element: <RequireRole roles={['ADMIN']} />,
            handle: { title: 'Admin' },
            children: [
              {
                element: <AdminLayout />,
                children: [
                  {
                    index: true,
                    handle: { title: 'Admin Dashboard' },
                    lazy: () =>
                      import('../../features/admin-dashboard/AdminDashboardPage').then((m) => ({
                        Component: m.AdminDashboardPage,
                      })),
                  },
                  {
                    path: 'resources',
                    handle: { title: 'Manage Resources' },
                    lazy: () =>
                      import('../../features/admin-resources/ManageResourcesPage').then((m) => ({
                        Component: m.ManageResourcesPage,
                      })),
                  },
                  {
                    path: 'users',
                    handle: { title: 'Users' },
                    lazy: () =>
                      import('../../features/admin-users/UsersPage').then((m) => ({
                        Component: m.UsersPage,
                      })),
                  },
                  {
                    path: 'loans',
                    handle: { title: 'Manage Loans' },
                    lazy: () =>
                      import('../../features/admin-loans/AdminLoansPage').then((m) => ({
                        Component: m.AdminLoansPage,
                      })),
                  },
                ],
              },
            ],
          },
          {
            path: '*',
            handle: { title: 'Page not found' },
            lazy: () =>
              import('../../features/not-found/NotFoundPage').then((m) => ({
                Component: m.NotFoundPage,
              })),
          },
        ],
      },
    ],
  },
  // Dev-only component gallery. Guarded by a statically-replaced constant
  // so the route (and its whole chunk) is dead-code-eliminated from
  // production builds, not just hidden behind a runtime check.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/design-system',
          lazy: () =>
            import('../../features/dev-design-system/DesignSystemPage').then((m) => ({
              Component: m.DesignSystemPage,
            })),
        },
      ]
    : []),
];
