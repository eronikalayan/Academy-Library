# Architecture overview

Academy Library is a pnpm-workspace monorepo with two deployable
applications and two shared packages.

```text
academy-library/
├── apps/
│   ├── web/            React + Vite SPA (feature-based structure)
│   └── api/             Express + Prisma modular-monolith backend
├── packages/
│   ├── contracts/       Shared Zod schemas and inferred types
│   └── config/          Shared TypeScript compiler configuration
├── infra/
│   └── docker/          Nginx config for the web image, Postgres init dir
├── docs/                This documentation
├── compose.yaml          Local/production-shaped multi-container stack
└── pnpm-workspace.yaml
```

## apps/web

A standalone Vite + React + TypeScript SPA. It does not use React Router's
"framework mode" (the Vite plugin that generates routes from the filesystem)
— routing is configured explicitly via `createBrowserRouter` in **data
mode**, giving full control while keeping Vite's plain build pipeline.

- `src/app/` — application shell:
  - `app/router/` — the route tree (`routes.tsx`, a plain route-object
    array) and the real data router built from it (`router.tsx`), kept in
    separate files for testing reasons — see "Testing strategy" in
    [`decisions.md`](./decisions.md). `types.ts` holds the shared
    `RouteHandle` shape (currently just `{ title }`) that route objects
    attach via `handle`, consumed generically by the breadcrumb. As of
    Task 05C.1, the authenticated branch is wrapped in `<RequireAuth/>`
    and the `/admin` branch additionally in `<RequireRole roles={['ADMIN']}/>`
    (see `app/auth/` below) — no other change to the tree's shape, lazy
    loading, or `errorElement`s.
  - `app/auth/` (Task 05C.1) — `RequireAuth` (gates the authenticated
    shell on a real session), `RequireRole` (gates `/admin` on role),
    `RedirectIfAuthenticated` (keeps an already-signed-in visitor off
    `/login`/`/register`), `safeRedirect.ts` (validates the `?from=`
    return-to destination against open-redirect), `FullPageState.tsx`
    (the shared loading-spinner/403-message layout the three guards
    above render). See
    [`docs/architecture/authentication.md`](./authentication.md)
    ("Frontend authentication").
  - `app/layouts/` — `PublicLayout` (unauthenticated routes: the home
    page, `/login`, `/register`), `AppLayout` (the authenticated shell:
    sidebar + header + content, owns sidebar-collapsed/mobile-drawer-open
    state), and `AdminLayout` (now a plain passthrough — the disclaimer
    banner it rendered through Task 05A is gone now that `/admin` is
    actually gated by `RequireRole`, itself backed by a real server-side
    session check; see decisions.md).
  - `app/providers/` — `AppProviders.tsx` composes the app-wide context
    providers (theme, error boundary, TanStack Query, toasts). No auth
    provider — authentication state lives entirely in TanStack Query's
    cache (`features/auth/api/useCurrentUser.ts`), not a separate
    context; see authentication.md for why.
  - `app/theme/` — the light/dark theme mechanism (unchanged since Task 02).
  - `RouteErrorFallback.tsx` — the shared `errorElement` used by both the
    public and app route branches.
- `src/widgets/` — composite, app-specific UI that is too specific to
  `academy-library`'s shell to belong in `shared/ui`, but isn't a page
  itself: `app-sidebar` (desktop sidebar + its nav list), `app-header`
  (page title/breadcrumb, search and notifications affordances, profile
  menu — as of Task 05C.1, `ProfileMenu`/`AppSidebar`/`SidebarNav` all
  read the real signed-in user via `useCurrentUser()`, replacing the
  Task 03 placeholder identity and dev role preview), `mobile-navigation`
  (the sub-1024px drawer), `page-header` (the title/description/actions
  block every feature page renders under).
- `src/shared/api/` (Task 05C.1) — the one HTTP boundary every API call
  in this app goes through: `httpClient.ts` (`apiRequest` — same-origin
  credentials, CSRF header attachment, Zod-validated responses),
  `ApiError.ts` (wraps the backend's `ApiErrorResponseSchema` envelope),
  `csrfToken.ts` (lazily fetches and caches the CSRF token — see
  authentication.md for why it is deliberately _not_ refetched around
  login/logout).
- `src/features/auth/` (Task 05C.1) — `LoginPage`/`RegisterPage` and
  their shared `AuthCard` visual wrapper, `authErrors.ts` (API error →
  user-facing copy and React Hook Form field errors), and `api/`
  (`authApi.ts`'s typed `login`/`register`/`logout`/`fetchCurrentUser`,
  plus one TanStack Query hook per operation). See authentication.md.
- `src/shared/config/` — `navigation.ts` (the single source of truth for
  sidebar/drawer nav items, with per-item optional role visibility —
  its `role` parameter is `Role | undefined` as of Task 05C.1, treating
  an unresolved session the same as "not permitted" for any gated item)
  and `roles.ts` (the `UserRole` union and display labels). Pure
  data/functions, no components.
- `src/shared/data/resources/` — the Resource domain's repository
  boundary: a typed `ResourceRepository` interface, the active
  `HttpResourceRepository` (real `fetch` calls against the
  `/api/v1/resources` backend Task 05B built, wired in Task 05C.2), and
  `mockResourceRepository` (deterministic, in-memory — kept for isolated
  tests and dev scenarios only, never the production default). No React
  in this directory — only the TanStack Query hooks under
  `features/library/api/` call into it. See
  [`docs/domain/resources.md`](../domain/resources.md).
- `src/features/<feature>/` — one directory per user-facing feature:
  `home`, `not-found`, `auth` (Task 05C.1, above), the dev-only
  `dev-design-system` showcase, a polished foundation page per main-nav
  route (`dashboard`, `collections`, `saved`, `loans`, `learning`,
  `settings`, and the `admin-dashboard`/`admin-resources`/`admin-users`
  admin pages — none of these do real data-fetching or CRUD, see "Out of
  scope for Task 03" in [`decisions.md`](./decisions.md)), and `library`
  — the one exception: `LibraryPage` and `ResourceDetailsPage`
  (`/library` and `/library/:resourceId`) are real TanStack Query
  consumers of `shared/data/resources`, with URL-driven
  search/filter/sort/pagination state (`hooks/useLibraryQueryState.ts`).
- `src/shared/ui/` — the reusable design-system component library
  (Button, Input, Modal, Dropdown, Toast, …) and `src/shared/hooks/` for
  the interaction logic behind it (portals, focus trap, outside-click,
  escape, scroll lock, focus restoration). See
  [`docs/design-system/README.md`](../design-system/README.md) for the
  full catalog, token architecture, and theming model.
- `src/styles/` — global CSS and design tokens (native CSS variables),
  loaded once from `main.tsx`.
- Route-level code splitting is done via React Router's `lazy` route
  property, not manual `React.lazy` — see `src/app/router/routes.tsx`.
- `vite.config.ts`'s dev server proxies `/api/*` to the local API (Task
  05A), so the browser only ever sees one origin in dev too — see
  [`docs/architecture/authentication.md`](./authentication.md) ("Cookie
  policy") for why that matters for the session cookie. As of Task
  05C.1, `preview.proxy` mirrors the same setting for `vite preview`
  (the production-build server Playwright e2e targets), which otherwise
  has no API to reach at all.

## apps/api

A modular-monolith Express service: all business logic lives in one
deployable process, organized by technical concern rather than split into
microservices. Real business domains get their own directory under
`src/modules/` — `modules/auth/` (Task 05A) was the first; `modules/resources/`
(Task 05B) follows the same `repository`/`service`/`policy` split rather
than being scattered across the `routes/`/`middleware/` split, which stays
reserved for request-pipeline concerns (routing, cross-cutting middleware,
shared error handling).

- `src/app.ts` — builds and configures the Express `app` (middleware,
  routes) but does not start a server. Kept separate from `server.ts` so
  the app can be imported directly into tests (via Supertest) without
  binding a real port.
- `src/server.ts` — the process entry point: starts the HTTP server and
  owns graceful shutdown.
- `src/config/env.ts` — validates `process.env` against a Zod schema at
  startup and exits fast on misconfiguration, instead of failing later with
  confusing runtime errors.
- `src/lib/` — infrastructure singletons (Pino logger, Prisma client) plus,
  since Task 05A, `password.ts` (Argon2id hashing), `sessionToken.ts`
  (random token generation/hashing), and `cookies.ts` (shared cookie
  attributes).
- `src/modules/auth/` — the session/user domain: `session.service.ts`,
  `user.repository.ts`, `auth.middleware.ts`
  (`optionalAuth`/`requireAuth`/`requireRole`), and `policy.ts` (a generic
  object-level authorization foundation — `hasRole`/`ownedBy`/`anyOf`/
  `allOf`/`authorize`). See
  [`docs/architecture/authentication.md`](./authentication.md).
- `src/modules/resources/` (Task 05B) — the Resource domain, split the
  same way: `resource.repository.ts` (Prisma + the raw-SQL full-text
  search/filter/pagination query), `resource.service.ts` (validation,
  tag/course/group resolution, orchestration), `resource.policy.ts`
  (visibility + create/modify rules, built on `modules/auth/policy.ts`'s
  generic helpers), `resource.mapper.ts` (DB row → public DTO), and
  `resource.types.ts`. See [`docs/domain/resources.md`](../domain/resources.md).
- `src/routes/`, `src/middleware/`, `src/errors/` — routing, cross-cutting
  middleware (CORS, Helmet, cookie parsing, CSRF/origin validation
  (Task 05A), rate limiting (Task 05A)), and the shared error-handling
  pipeline.
- `prisma/` — the Prisma schema (`User`/`Session` from Task 05A;
  `Resource`/`Course`/`Tag`/`Group`/`GroupMembership` and their join
  tables from Task 05B — see domain/resources.md for the schema and
  migration strategy) and migration history, plus `seed.ts`
  (`pnpm db:seed`) for development accounts, groups, courses, and a
  varied set of resources — see [`docs/development.md`](../development.md)
  for how to run migrations and seeds.

## packages/contracts

Zod schemas (and their inferred TypeScript types) shared between `web` and
`api`, so the two apps cannot silently drift on request/response shapes.
Alongside the infrastructure contracts (health/ready responses, the API
error envelope) from Task 01: `resource.ts` (Task 04, implemented by
`apps/api` in Task 05B — see [`docs/domain/resources.md`](../domain/resources.md)
for the small, documented set of narrowing/additive changes Task 05B made
to it) and `auth.ts` (Task 05A) — `RegisterInputSchema`/`LoginInputSchema`/
`PublicUserSchema`/`AuthResponseSchema`, see
[`docs/architecture/authentication.md`](./authentication.md).

## packages/config

Shared `tsconfig` bases (`tsconfig.base.json`, `tsconfig.node.json`) that
every other package/app extends, so compiler strictness stays consistent
project-wide. ESLint and Prettier are configured once at the repo root
instead (see `eslint.config.mjs`), since linting the whole repository from
one place is simpler than per-package configs at this scale.

## Request flow (today)

```text
Browser ──▶ apps/web (Vite dev proxy / nginx reverse proxy) ──▶ one origin
                 │
                 ▼
apps/api  /api/v1/health          → liveness, no dependencies checked
          /api/v1/ready           → liveness + a live `SELECT 1` against Postgres
          /api/v1/auth/register   → creates a STUDENT account
          /api/v1/auth/login      → verifies credentials, sets the session cookie
          /api/v1/auth/me         → resolves the session cookie, returns the user
          /api/v1/auth/logout     → revokes the session, clears the cookie
          /api/v1/resources       → list/search (GET, optional auth), create (POST, LECTURER/ADMIN)
          /api/v1/resources/:id   → detail (GET, optional auth), update (PATCH), delete (DELETE)
                 │
                 ▼
            PostgreSQL (via Prisma + one hand-written raw-SQL search
            query) — User, Session (Task 05A); Resource, Course, Tag,
            Group, GroupMembership, and their join tables (Task 05B)
```

As of Task 05C.1, `apps/web` is a real consumer of the `/auth/*`
endpoints above: `/login`, `/register`, and the authenticated shell's
session check (`RequireAuth`) all call them directly — see
`docs/architecture/authentication.md` ("Frontend authentication") for
the client-side half. As of Task 05C.2, the Library Explorer is a real
consumer of `/api/v1/resources` too — `HttpResourceRepository` replaced
the frontend-only mock as the active implementation (see
[`docs/domain/resources.md`](../domain/resources.md), "Frontend
integration (Task 05C.2)"). See
[`docs/architecture/authentication.md`](./authentication.md) for the
auth endpoints' full contracts, and `docs/domain/resources.md`
for the Resource domain's schema, authorization rules, and search
strategy.
