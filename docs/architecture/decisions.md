# Architecture decisions and assumptions

Lightweight decision log, starting with Task 01 (project foundation).
Newer entries are added at the bottom of each section as the project
evolves.

## Stack choices within the approved list

- **Node.js 22 (LTS)** was chosen over Node 24/25 as the Docker/CI baseline.
  22 is the current Active/Maintenance LTS line at the time of writing;
  24 only recently became LTS and 25 is a Current (non-LTS) release. Local
  development works on any Node ≥ 22 — the repo does not pin an exact
  patch version. See `.nvmrc` and `engines.node` in the root
  `package.json`.
- **Express 5** (not 4). Express 5 forwards rejected promises from async
  route handlers to error-handling middleware automatically, which removes
  the need for a hand-rolled `asyncHandler` wrapper around every route —
  directly relevant to the "consistent error handling" requirement.
- **React Router v6 (Data Mode)**, not v7. The task calls for "Data Mode"
  (`createBrowserRouter`, loaders, `lazy` routes), which is a v6.4+
  capability that v7 continues under a renamed package. v6 is used here in
  **library mode** (plain `react-router-dom`), not v7's "framework mode"
  Vite plugin, since the task asks for a standalone Vite + React setup with
  routing configured explicitly, not a meta-framework.
- **Zod v3**, not the newer v4 line, for broader ecosystem compatibility
  with the other libraries pinned here at the time of writing.
- **Vitest + React Testing Library + Supertest** for unit/integration
  tests, **Playwright configured but not wired into CI** — see "Testing
  strategy" below.

## Monorepo & tooling

- **pnpm workspaces**, not Turborepo/Nx. The task's scope (2 apps, 2
  packages) doesn't yet justify a build-orchestration tool; `pnpm -r` with
  `--filter` covers it. Revisit if the number of packages or the need for
  cross-package build caching grows significantly.
- **One root ESLint flat config** (`eslint.config.mjs`) instead of
  per-package configs. TypeScript compiler strictness is still shared via
  `packages/config/tsconfig.*.json`, but linting the whole repository from
  a single config is simpler at this scale and keeps rules consistent
  across `apps/web` and `apps/api`.
- **No Turborepo-style remote caching, no changesets/versioning** — this is
  a private, non-published monorepo; semantic versioning across packages
  isn't a current need.

## packages/contracts

- Contains **only infrastructure contracts** (health/ready responses, the
  API error envelope) — deliberately no business entities, per the task's
  explicit scope boundary. The first real business schema (e.g. a
  `Resource`) should be added here, not duplicated between `web` and `api`.

## Database

- **`SchemaProbe` is a deliberate placeholder model**, not a real entity.
  Its only purpose is to prove the Prisma → PostgreSQL pipeline (schema →
  migration → generated client → live query via `/api/v1/ready`) works
  end-to-end without inventing business schema ahead of scope. It should be
  dropped in the task that introduces the first real model, via a normal
  migration (`prisma migrate dev`), not by hand-editing migration history.
- Migrations are **Prisma's own migration history**
  (`apps/api/prisma/migrations/`), not a separate tool — see
  [`docs/development.md`](../development.md) for how they run locally vs.
  in Docker/production.

## Docker

- **`pnpm deploy` was tried and abandoned** for the API's production image.
  It produces a pruned, "injected" `node_modules` from pnpm's
  content-addressable store, but the Prisma client is generated **directly
  into `node_modules`** by `prisma generate` — that generated output isn't
  part of pnpm's store bookkeeping, and `pnpm deploy` silently failed to
  carry it into the deployed tree (symptom: `Cannot find module
'@prisma/client'` / a broken CJS/ESM interop error inside the running
  container, despite the exact same code working outside Docker). The
  Dockerfile instead builds the whole workspace, runs `pnpm prune --prod`
  **in place**, and copies that entire pruned tree into the runtime image.
  This is a larger image than a hand-trimmed deploy would produce; revisit
  if image size becomes a real constraint.
- A separate **`migrate` Compose service** (not a migration step baked into
  the API image's entrypoint) runs `prisma migrate deploy` before `api`
  starts (`depends_on: condition: service_completed_successfully`). It
  targets the Dockerfile's `build` stage, which still has the `prisma` CLI
  (a devDependency) available — the pruned `runtime` image intentionally
  does not.
- **Compose healthchecks use `127.0.0.1`, not `localhost`.** Alpine's
  `wget` resolved `localhost` to the IPv6 loopback (`::1`) first, but the
  API binds only to IPv4 `0.0.0.0` — every healthcheck probe failed with
  "connection refused" even though the server was running and reachable on
  IPv4. Any future healthcheck or in-container HTTP probe should use
  `127.0.0.1` for the same reason.
- `apps/*/tsconfig.build.tsbuildinfo` files (from local `incremental: true`
  TypeScript builds) were getting copied into the Docker build context and
  made `tsc` under-emit (it trusted a stale cache that didn't match the
  container's empty `dist/`, and only recompiled the files it considered
  "changed"). Fix: removed `incremental`/`composite` from the shared
  `tsconfig.base.json` entirely rather than just `.dockerignore`-ing the
  cache file, since the same class of bug could otherwise resurface locally
  (e.g. after switching branches). `*.tsbuildinfo` is still ignored in both
  `.gitignore` and `.dockerignore` defensively.
- Both production images run as **non-root** (`academy` user for the API,
  the stock `nginx` user for the web image, which `index.html` falls back
  to via Nginx's `try_files` for client-side routing).

## Testing strategy

- **React Router's data router (`createBrowserRouter`) is not mounted in
  unit tests.** It calls `.initialize()` eagerly, which constructs a
  `Request`/`AbortSignal` internally — under Vitest's `jsdom` environment
  this throws (`Expected signal to be an instance of AbortSignal`), a known
  jsdom/Node `fetch` polyfill mismatch (jsdom's `AbortController` differs
  from the one Node's built-in `Request` expects). Rather than fight that
  mismatch, `router.tsx` (which calls `createBrowserRouter`) and
  `routes.tsx` (the plain route-object array, with no router
  construction) were split so tests can assert the route configuration's
  shape and render individual page components (wrapped in the classic,
  non-data `<MemoryRouter>` where a router context is needed) without ever
  constructing the real data router. The real data router is exercised by
  the browser (and would be by Playwright e2e, once wired into CI).
- **Playwright is configured but not run in CI** — there are no business
  screens yet worth an end-to-end suite. `apps/web/playwright.config.ts`
  and `apps/web/tests-e2e/` exist so the next task that adds a real user
  flow can start writing e2e tests immediately.

## Out of scope for Task 01 (confirmed against the task brief)

- No business entities, authentication, or RBAC.
- No dashboard/sidebar/resource-card UI — only a placeholder home page and
  a 404 page.
- No Reel/Skill Map/Depot integration code.

---

# Task 02 — design system

Full rationale for tokens, theming, and the component catalog lives in
[`docs/design-system/README.md`](../design-system/README.md); this
section covers decisions outside that doc's scope.

## New dependencies

- **`@hookform/resolvers`** — the standard glue between React Hook Form
  and Zod (both already approved/installed in Task 01). Needed to wire
  the Forms showcase section's Zod schema into `useForm`; without it
  there's no supported way to connect the two.
- **`@testing-library/user-event`** — standard companion to React
  Testing Library for realistic click/type/keyboard interaction tests
  (clicking, typing, `Tab`, arrow keys). The task explicitly asked for
  interaction tests, not render-only ones; `fireEvent` alone doesn't
  simulate real browser event sequences well enough for things like
  focus-trap Tab-wrapping.
- No other dependencies were added — all overlay behavior (portal, focus
  trap, outside-click, escape, scroll lock, focus restoration) is
  hand-rolled in `shared/hooks/` rather than pulling in Radix/Headless
  UI/Floating UI, per the task's "no pre-styled component libraries"
  constraint and to keep the dependency surface small.

## Component architecture

- **`Dropdown` is deliberately not portaled**, unlike `Modal`. A
  portaled menu (appended to `document.body`) breaks natural Tab order
  — pressing Tab to leave the menu would jump to whatever happens to be
  next in `document.body`'s child order, not the next element after the
  trigger visually. `Dropdown`'s menu is `position: absolute` inside a
  `position: relative` wrapper right next to the trigger instead, which
  keeps Tab order correct at the cost of being clippable by an
  `overflow: hidden` ancestor — acceptable for a design-system primitive
  with no such ancestor yet; revisit with real positioning (Floating UI)
  if that becomes a problem.
- **Badges, by default, use soft tinted backgrounds with a darker
  text/icon of the same hue, not solid fills with white text.** Several
  of the brief's suggested semantic colors (warning in particular)
  don't have enough contrast against white to use as a white-label solid
  fill at all — tinted badges sidestep that problem entirely and also
  read as more "premium and restrained" per the brief's own direction.
  `Button`'s `destructive` variant still needs a solid white-label fill
  (it's an explicit requirement), which is why `--color-danger-fill` was
  split out from `--color-danger` — see the design-system doc.
- **`Tooltip` takes a single child via `cloneElement`**, not a
  render-prop or a wrapping trigger component, to keep
  `<Tooltip content="...">`'s call sites simple. This constrains
  `children` to `ReactElement<TooltipTriggerProps>` (a small local
  interface listing just the handlers it injects) specifically to avoid
  `any`-typed access to `children.props` under this repo's
  type-checked-lint rules.

## Testing environment gaps found and fixed

Two real bugs surfaced only once multi-test-case component test files
were added (Task 01's single HomePage test never exercised either path):

- **React Testing Library's auto-cleanup never ran.** It only
  self-registers against a _global_ `afterEach`, and this project's
  `vitest.config.ts` doesn't set `test.globals: true` — every test in a
  file was rendering into the same document without unmounting the
  previous one. Fixed with an explicit `afterEach(cleanup)` in
  `src/test/setup.ts`.
- **jsdom here doesn't provide a working `localStorage` or
  `window.matchMedia`** (methods exist but throw/aren't callable) —
  both are polyfilled in the same setup file: a minimal in-memory
  `Storage` implementation, and a `matchMedia` stub that always reports
  `matches: false`.
- **A genuine focus-restoration race**, not just a test artifact:
  `useRestoreFocus` captured `document.activeElement` in a passive
  `useEffect`, but `Modal`'s focus trap (and `DropdownMenu`'s
  "focus the first item" effect) are _also_ passive effects that move
  focus into the newly-opened content — and effect order across
  components isn't guaranteed to put the capture first. The captured
  "previously focused element" ended up being the modal's own close
  button, which then unmounts, so focus silently fell back to
  `<body>` on close. Fixed by moving the capture to `useLayoutEffect`:
  all layout effects across the tree run before any passive effect,
  regardless of component position, so it now reliably wins the race.

## Out of scope for Task 02 (confirmed against the task brief)

- No resource CRUD, Prisma models, or other backend/business logic.
- No final sidebar/dashboard layout or full business pages — `RootLayout`
  only gained a `ThemeToggle` in its existing header.
- `Pagination` and `Alert`'s "assertive" live-region variant for errors
  specifically were the two items from the suggested component list
  intentionally left out: `Pagination` has nothing to paginate yet
  (there's no list/table anywhere in the app), and splitting toast
  announcements across a polite/assertive pair of live regions by
  variant felt like premature complexity for a notification system with
  exactly one consumer so far.

---

# Task 03 — application shell & navigation

## Project structure: `widgets/` added, `features/*` kept (no `pages/*`)

The brief suggested a `pages/*` tree alongside `widgets/*`. `pages/*` was
not created — it would have duplicated the `features/<feature>/` convention
already established in Tasks 01–02 at exactly the same granularity (one
directory per user-facing screen, owning its own component, CSS Module, and
tests). `widgets/` **was** added as a genuinely new layer: composite,
app-shell-specific UI (`app-sidebar`, `app-header`, `mobile-navigation`,
`page-header`) that is too specific to this app's shell to belong in
`shared/ui`, but isn't a page either. `app/router/` and `app/providers/`
are new subdirectories of the existing `app/` layer rather than a
parallel structure — `routes.tsx`/`router.tsx`/`router.test.tsx` moved
into `app/router/`, and `main.tsx`'s provider tree was extracted into
`app/providers/AppProviders.tsx`.

## Dark sidebar/drawer via local token overrides, not a parallel color namespace

The sidebar and mobile drawer are always dark, independent of the
app-wide light/dark theme toggle. Rather than inventing a second
`--sidebar-*` token namespace (which every component that renders inside
the sidebar — `Avatar`, `IconButton`, `Select`, `Tooltip` — would need a
bespoke dark variant to understand), `AppSidebar.module.css` and
`MobileNavDrawer.module.css` **locally redeclare the existing generic
`--color-*` custom properties** (`--color-bg`, `--color-surface`,
`--color-text-primary`, `--color-accent`, …) on their own root class,
scoped by normal CSS cascade/inheritance to everything inside. Every
reused `shared/ui` component keeps working unmodified because it only
ever reads the generic token names. Only three new tokens were added to
`tokens.css` for this task, all layout (not color):
`--layout-sidebar-width`, `--layout-sidebar-width-collapsed`,
`--layout-drawer-width`.

## Drawer breakpoint: `<1024px`, not a separate tablet rule

The brief's breakpoint table lists tablet (768–1023px) and mobile
(<768px) as distinct ranges, but both get the drawer; only desktop
(≥1024px, covering the brief's 1024–1439px and 1440px+ rows together)
gets the persistent, collapsible sidebar. A single `@media (max-width:
1023px)` rule in `AppSidebar.module.css` / `AppHeader.module.css` /
`AppLayout.module.css` draws that one line rather than adding a second,
functionally-identical breakpoint for tablet — there is no behavioral
difference between "drawer at 900px" and "drawer at 500px" that the task
asked for.

## `MobileNavDrawer` reuses the overlay **hooks**, not the `Modal` **component**

`Modal` is visually centered with its own header/footer chrome, which
doesn't match a slide-in, full-height, edge-anchored navigation drawer —
wrapping `<Modal>` and fighting its layout would have been the
"inappropriate abstraction" the brief warned against. Instead
`MobileNavDrawer` calls the same underlying hooks `Modal` is built from
directly: `usePortal`, `useFocusTrap`, `useEscapeKey`, `useOutsideClick`,
`useScrollLock`, `useRestoreFocus` (all from Task 02's `shared/hooks/`).
This gets correct focus-trap/Escape/backdrop/scroll-lock/focus-restore
behavior without duplicating that logic or forcing an unrelated visual
shape onto `Modal`.

## Honest placeholders: `ComingSoonDialog`, not fake buttons

Header search and notifications, and two admin "create" actions, have no
real implementation yet. Rather than leaving dead-looking buttons or (worse)
faking success, all four open a shared `shared/ui/ComingSoonDialog`
(`Modal` + `EmptyState`, Sparkles icon, "Coming soon") that honestly states
the feature isn't built yet. This is the one new `shared/ui` addition this
task made for the shell itself (the other, `StatCard`, is a small
Card-based metric display used by the Dashboard and Admin Dashboard
placeholder pages).

## Role-based navigation preview is explicitly **not** authorization

`app/dev/RoleProvider` + `useRole` hold an in-memory (never persisted)
`UserRole` (`STUDENT` by default) purely to preview how the sidebar/admin
section look under each role while there is no real authentication yet.
`RoleSwitcher`, the `<Select>` that changes it, is gated behind
`import.meta.env.DEV` at every call site (sidebar footer, Settings page)
and is confirmed fully tree-shaken out of the production bundle (`pnpm
build` output contains zero occurrences of "Preview role" or
`design-system`, same check used in Task 01/02 for the dev-only design
system route). `AdminLayout` also renders a persistent, non-dismissable
`Alert` stating plainly that reaching `/admin/*` is not currently gated by
any real permission check — this UI-only visibility rule must not be
mistaken for security until a real backend auth/RBAC system exists.

**Superseded in Task 05C.1**: once real authentication existed to
replace it with, this entire mechanism (`RoleProvider`/`useRole`/
`RoleSwitcher`, and `AdminLayout`'s disclaimer banner) was deleted
rather than left alongside the real thing — see that task's own
section below for why, and `docs/architecture/authentication.md`
("Frontend authentication") for what replaced it.

## A real CSS bug found only through browser testing

Manual visual verification (not caught by lint/typecheck/unit tests)
found the collapsed sidebar's icon tooltips clipped at the sidebar's right
edge, showing only a sliver of text. Cause: `AppSidebar.module.css`'s
`.navScroll` had `overflow-y: auto; overflow-x: hidden;` — per the CSS
overflow spec, once one axis is set to a non-`visible` value, the other
axis (left at its default `visible`) is forced to compute as `auto` too,
so the `Tooltip`'s `position: absolute` content got clipped instead of
escaping the sidebar. Fixed by removing both `overflow-x`/`overflow-y`
from `.navScroll` entirely — the nav list (10 items max) never actually
reaches viewport height in practice, so it does not need to be its own
scroll container. Verified by comparing before/after screenshots of the
collapsed sidebar's hover tooltip.

## Out of scope for Task 03 (confirmed against the task brief)

- No resource CRUD, filtering, search, or final library/catalogue design
  — `LibraryPage` contains a single, explicitly-labeled static preview
  grid to demonstrate layout composition only.
- No authentication, no real authorization/RBAC, no mock login system —
  role preview is dev-only UI, never a security boundary (see above).
- No Redux/RTK Query; TanStack Query (already in place from Task 01/02)
  was not replaced.
- No new CSS framework — all shell styling uses the existing CSS Modules
  - design tokens.

---

# Task 04 — Resource domain contracts & Library Explorer

Full rationale for the domain contracts, the mock/HTTP repository
boundary, and the REST contract they assume lives in
[`docs/domain/resources.md`](../domain/resources.md); this section
covers decisions outside that doc's scope.

## `shared/data/resources/` as a new layer

Repository-pattern data access didn't have a home in the existing
`shared/{ui,hooks,config}` taxonomy — `config` is static data/pure
functions, not an async boundary. `shared/data/resources/` was added as
a sibling, read-only (`list`/`getById` only — no write methods, since
nothing in this task implements writes) and framework-agnostic (no React
inside it; only the TanStack Query hooks in `features/library/api/`
import from it).

## A real CSS bug found only through browser testing

Manual verification (not caught by lint/typecheck/unit tests) found
every resource card rendering as nothing but an oversized cover image —
title, author, and description were present in the DOM but invisible,
clipped below the card's `overflow: hidden` boundary. Cause:
`ResourceCover`'s wrapping `.frame` class set `height: 100%` directly,
which — per spec — always wins over a sibling `aspect-ratio` rule once
both would apply to the same box. In grid mode, that `height: 100%`
resolved against a CSS-grid-stretched `<li>` ancestor's full height,
so the cover claimed the entire card instead of a 16:10 banner at the
top, squeezing the text body out of the visible area entirely. Fixed by
removing the explicit height: grid mode now sizes purely from
`aspect-ratio` (`width` only), and list mode sizes correctly from the
parent flexbox's default `align-items: stretch` — no explicit height
needed in either case. A second, smaller bug from the same testing pass:
three new `<ul>` lists (`ResourceGrid`, the card's tag list, and
`Pagination`'s page-number list) were missing `list-style: none`,
leaving stray bullet markers between grid cells.

## `type="text"`, not `type="search"`, for the search field

`SearchBar` renders its `Input` as `type="text"` rather than the
semantically-closer `type="search"`. Chrome (and most browsers) render
their own built-in clear button for `type="search"` inputs once there's
a value — which duplicated the custom `IconButton` clear control already
wired to the debounce/URL logic, producing two visible "X" controls at
once. Found via manual browser testing, not caught by any automated
test (jsdom doesn't render the native control).

## `resetAll`, not `setSearch('') + clearFilters()`, for "clear everything"

The empty-results state's "Clear search & filters" action originally
called `setSearch('')` followed by `clearFilters()` — two independent
`setSearchParams` calls in the same handler. This is a real React Router
footgun: each call's updater function reads `searchParams` as it exists
at call time, so the _second_ call doesn't see the first call's
not-yet-applied change and can clobber it. In practice, `clearFilters()`
(which never touches `search`) won, leaving the search term in place —
a caught, reproducible bug (`useLibraryQueryState.test.tsx`'s regression
test documents the broken two-call pattern directly, not just the fix).
Fixed by adding a `resetAll()` method that clears search and every
filter in a single `setSearchParams` update.

## Pagination added to `shared/ui`

Task 02's decision log explicitly deferred `Pagination` ("nothing to
paginate yet"). This task is that trigger: a simple Prev/Next +
every-page-number control (no first/last + ellipsis windowing — the
40-fixture catalogue at a fixed page size of 12 never produces enough
pages to need it) was added to `shared/ui/Pagination`, following the
same component/CSS-module/test/barrel-export conventions as every other
primitive there.

## CSS-only cover placeholders, no hotlinked images

Every fixture's `coverImageUrl` is intentionally absent — see
docs/domain/resources.md. The Library Explorer never depends on an
external image resolving for its layout or tests to be correct; the
real-`<img>` + `onError`-fallback code path in `ResourceCover` exists
and is unit-tested (simulating a failed load via `fireEvent.error`), but
isn't exercised by any fixture today.

## Out of scope for Task 04 (confirmed against the task brief)

- No Prisma `Resource` model and no `/api/v1/resources` routes — the
  mock repository and `HttpResourceRepository`'s assumed contract are
  the full extent of backend-facing work; see docs/domain/resources.md
  for what the next task would need to build to match.
- No authentication or real authorization — `RESTRICTED` visibility is
  shown, not enforced (same non-authoritative framing as Task 03's role
  preview).
- No bookmarks or collection mutations on the resource detail page.
- TanStack Query (already in place) was not replaced; no custom
  server-state cache was layered on top of it.

---

# Task 05A — database & secure authentication foundation

Full rationale for the session design, cookie/CSRF strategy, role
model, API contracts, database schema, migration approach, and
development accounts lives in
[`docs/architecture/authentication.md`](./authentication.md); this
section covers decisions outside that doc's scope.

## `src/modules/auth/` as the first `modules/` directory

Task 01's own `overview.md` anticipated this: "real business domains...
should get their own directory under `src/` (e.g.
`src/modules/resources/`)". `modules/auth/` is the first one, holding
the session service, user repository, auth middleware, and the
object-level policy foundation — `src/routes/auth.routes.ts` and
`src/middleware/{csrf,rateLimit,validateOrigin}.ts` stay at the
existing top-level `routes/`/`middleware/` layers (request-pipeline
concerns Task 01 already established a home for), rather than moving
everything auth-related into the new directory wholesale.

## Same-origin by default: Vite proxy in dev, nginx reverse proxy in Compose

Both changes exist purely to make `SameSite=Lax` actually sufficient
scope-wise (see authentication.md's "Cookie policy") without resorting
to cross-site cookie exceptions:

- `apps/web/vite.config.ts` gained a `server.proxy` entry forwarding
  `/api/*` to the local API, and both `apps/web/.env.example`/`.env`
  changed `VITE_API_BASE_URL` from an absolute `http://localhost:4000/api/v1`
  to a relative `/api/v1` — neither is consumed by any frontend code
  yet (Task 04 only built a mock repository), so this is a pure
  infrastructure change, not a behavior change to anything currently
  running.
- `infra/docker/web/nginx.conf` gained a `location /api/` reverse-proxy
  block to the `api` Compose service. This closes a real, pre-existing
  gap: the `web` Compose service's `VITE_API_BASE_URL` already defaulted
  to the relative `/api/v1` (set in `apps/web/Dockerfile`/`compose.yaml`
  since Task 01), but nginx had no handler for that path at all — any
  future frontend code calling it through the Compose stack would have
  silently hit the SPA's catch-all `try_files` fallback instead of the
  API. Discovered while implementing the "prefer a same-origin `/api`
  reverse-proxy deployment" requirement, not a pre-existing bug report.

## `Secure` tied to `NODE_ENV`, not a per-request HTTPS check

`csrf-csrf`'s cookie options are configured once, at startup, with no
per-request hook — so the session cookie's `Secure` flag (set directly
by this app's own `res.cookie()` call) and the CSRF cookies' `Secure`
flag (set by the `csrf-csrf` library) needed to agree on the _same_
rule to stay consistent, and only a static, startup-time rule can
satisfy both. `NODE_ENV === 'production'` was chosen over a dynamic
`req.secure` (which Express can compute per-request, respecting `trust
proxy`) for exactly that reason — see authentication.md's "Cookie
policy" and "Known limitations" for what this means for the bundled
Docker Compose stack specifically.

## `authRateLimiter` is skipped under `NODE_ENV=test`

Found via a genuinely flaky integration-test run, not designed in
upfront: `express-rate-limit`'s default in-memory store is one counter
per process for the limiter's entire lifetime, and
`tests/auth.routes.test.ts` shares one `createApp()` instance across
its whole file. Enough register/login requests across unrelated test
cases accumulated against the _same_ limiter instance to start 429-ing
later tests' logins for reasons that had nothing to do with what those
tests were checking — intermittently, and only once enough tests ran
before the affected one, which is why it surfaced as "passes in
isolation, fails in the full suite" rather than a deterministic
failure. Fixed with `skip: () => env.NODE_ENV === 'test'` on the real
limiter, with the limiting _mechanism_ itself verified separately
against an isolated, non-shared instance (`tests/rateLimit.test.ts`).

## Out of scope for Task 05A (confirmed against the task brief)

- No Resource/Course/Tag/Collection Prisma models and no Resource CRUD
  — this task is the database/auth foundation those will sit on top of.
- No frontend login/registration pages, and the Library Explorer
  (Task 04) was not touched.
- No JWTs, no OAuth, no password reset, no email verification — see
  authentication.md's "Known limitations" for which of these are
  genuine pre-launch requirements versus deliberately deferred scope.
- No Redux; TanStack Query (already in place) was not replaced.

## `modules/resources/` repeats the `modules/auth/` split (Task 05B)

`repository` (Prisma + the one raw-SQL search/filter/pagination query),
`service` (validation, association resolution, orchestration), `policy`
(authorization rules), `mapper` (DB row → public DTO) — the same shape
Task 05A's `modules/auth/` already established, not a new pattern
invented for this domain. `resource.policy.ts`'s `canModifyResource` and
`canCreateResource` are built directly on Task 05A's generic
`hasRole`/`ownedBy`/`anyOf`/`allOf` from `modules/auth/policy.ts` — that
file's own doc comment anticipated exactly this (`ownedBy<Subject
extends { ownerId: string }>()`, written before any `ownerId`-bearing
model existed) when it was added in Task 05A.

## `Group`/`GroupMembership` introduced, not deferred (Task 05B)

The task brief's `restrictedToGroupIds` field has existed in the
contracts since Task 04, but nothing backed it — the mock repository
returns `RESTRICTED` resources unconditionally (see
domain/resources.md). Enforcing it for real needed somewhere a group id
actually resolves to, and someone to check membership against — the
brief explicitly called out building "the minimal normalized group/
membership foundation" rather than faking enforcement against ids that
resolve to nothing. Kept deliberately minimal: no Group CRUD API, only
what `ResourceGroup`'s many-to-many needs (see domain/resources.md,
"Database schema").

## Two raw queries for list/search, not one with `COUNT(*) OVER()`

A single query combining paginated ids and a `COUNT(*) OVER()` window
total is a common trick, but it has a real edge case here: a window
function's value is only readable off a _returned_ row, and an
out-of-range page (`page` beyond the last one) legitimately returns
zero rows — so there is no row left to read the total off of, exactly
when "correct empty results" (the task's own requirement) matters most.
Two queries sharing the identical `Prisma.sql` `WHERE` fragment — one
`COUNT(*)`, one the actual page of ids — has no such edge case and
cannot let the two disagree with each other. Still not an N+1: fixed at
two raw queries plus one Prisma `findMany` to hydrate relations,
regardless of page size (see `findVisibleResourcePage`'s doc comment in
resource.repository.ts).

## Visibility gates existence disclosure for writes too, not just reads

A resource `PATCH`/`DELETE` by someone who cannot even _see_ the target
(restricted, not their group, not their resource) returns `404`, the
same as a resource that genuinely doesn't exist — not `403`, which would
confirm it exists. Only once a resource is confirmed visible does a
missing _write_ permission become `403` (you can see it; you're just not
allowed to change it). This generalizes the read-path "don't reveal
restricted-resource existence" rule to writes, rather than treating
reads and writes as two independent authorization questions with two
different existence-disclosure policies.

## Tags are a folksonomy; Courses and Groups are curated (Task 05B)

The task brief asks to "validate course/tag associations," worded as if
symmetric — but the contracts give Tag no identity beyond a bare string
with no creation endpoint, while Course/Group are real, seed/admin-
managed entities a client can only _reference_. Rather than silently
picking one reading, both are documented explicitly in
domain/resources.md ("Scope decisions"): an unrecognized `courseId` or
group id is rejected (`400`); an unrecognized tag name is created on the
spot (trimmed, lowercased, upserted) — a resource create/update is the
only way a new tag ever comes into existence, same as how
`POST /auth/register` was Task 05A's only path to a new `User`.

## `coverImageUrl`/`sourceUrl` schema tightened to reject unsafe URL schemes

`apps/web/src/shared/data/resources/url.ts`'s `isSafeHttpUrl` already
carried a doc comment stating plainly that `z.string().url()` permits
`javascript:`/`data:` schemes and is only ever used as a render-time
guard because of it — a documented gap in an existing contract, which
the task's own instructions call out as something to fix with the
smallest justified correction, not leave as a known hole. Closed with a
shared `SafeHttpUrlSchema` refinement in `packages/contracts/src/resource.ts`,
applied everywhere `coverImageUrl`/`sourceUrl` appear. Backward-compatible
by construction (narrows, never widens); the frontend guard is
unchanged and still runs, since it protects against any data written
before this check existed.

## Two real bugs found while building the resource test suite

Found during this task's own test-writing, not designed in upfront —
captured here in the same spirit as Task 05A's `authRateLimiter`
discovery above:

- **A CSRF test helper regression, self-inflicted mid-task.** Extending
  `tests/helpers/testClient.ts`'s `postWithCsrf` to also support
  `patchWithCsrf`/`deleteWithCsrf` initially took an already-constructed
  `request.Test` as a parameter, built by the caller _before_ the shared
  helper's `await client.csrfToken()` call. `client.post(path)` snapshots
  the `supertest.agent`'s cookie jar at construction time — building it
  before the token fetch meant the write request went out missing the
  very `csrf_secret` cookie the just-fetched token was bound to, failing
  every login in the new resource test file with a confusing
  `INVALID_CSRF_TOKEN` (not an auth failure) that did not reproduce in a
  standalone script using the same flow by hand. Fixed by having the
  shared helper build the request itself, from a path string, strictly
  after the token fetch resolves — see `sendWithCsrf`'s doc comment in
  testClient.ts.
- **A real cross-file race, latent since Task 05A, triggered by adding a
  second DB-touching test file.** `tests/auth.routes.test.ts`'s
  `resetAuthTables()` (sessions + users) was sufficient while it was the
  _only_ test file resetting those tables. Adding
  `tests/resources.routes.test.ts` — which creates `Resource` rows owned
  by users, and whose own `beforeEach` only cleans up at the _start_ of
  each test, not after the suite's last one — meant a leftover resource
  could still reference a user by the time a _different file_ tried to
  delete that user, violating `Resource.ownerId`'s `onDelete: Restrict`
  foreign key. Fixed two ways: both files now call the fuller
  `resetAllTables()` (resources, then auth tables, in dependency order —
  see tests/helpers/db.ts) instead of `resetAuthTables()` directly, and
  `apps/api/vitest.config.ts` gained `fileParallelism: false` so test
  files sharing one real database can never race each other on worker
  scheduling regardless of which tables any given file touches.

## Out of scope for Task 05B (confirmed against the task brief)

- No frontend authentication UI, and `apps/web` was not switched to the
  real `/api/v1/resources` endpoints — the Library Explorer still runs
  against its mock repository (see domain/resources.md).
- No bookmarks, collections, physical book loans, or Reel/Depot/Skill
  Map integrations.
- No Redux; TanStack Query was not replaced.
- No Elasticsearch/Meilisearch/Redis — search is plain PostgreSQL
  full-text search plus `pg_trgm`, per the brief's explicit instruction.
- No Group CRUD API, no `/courses`/`/tags` metadata endpoints — see
  domain/resources.md's "Scope decisions" for why neither was added.

---

# Task 05C.1 — frontend authentication & session integration

Full architectural write-up lives in
[`docs/architecture/authentication.md`](./authentication.md)'s new
"Frontend authentication" section — this covers decisions outside that
doc's scope, plus what was found or broke along the way.

## No AuthContext — TanStack Query's cache is the only auth store

The task brief is explicit that this must not become "a custom
duplicate authentication cache." A second React Context holding a copy
of the signed-in user would be exactly that: a second place that could
disagree with the `['auth', 'me']` query (e.g. mid-logout, or if one
forgot to update while the other updated), with no principled answer
for which one is right. Every consumer — `RequireAuth`, `RequireRole`,
`ProfileMenu`, `AppSidebar`, `SidebarNav`, `SettingsPage` — calls
`useCurrentUser()` directly instead.

## MSW pinned to v2, not the latest v3

`pnpm add -D msw` resolved `3.0.7` by default, which immediately
surfaced two peer-dependency conflicts: `msw@3` itself wants `vite@>=6`
(this project is pinned to `5.4.x`), and `@vitest/mocker` (part of the
installed `vitest@2.1.9`) wants `msw@^2.4.9`. Reinstalled as `msw@^2`
instead of chasing an unplanned Vite/Vitest major-version upgrade to
satisfy a test-tooling dependency — out of scope for this task either
way.

## A real synchronous-throw bug, found by the test suite

`features/auth/api/authApi.ts`'s `login`/`register` were originally
plain functions whose body called `LoginInputSchema.parse(input)`/
`RegisterInputSchema.parse(input)` and returned `apiRequest(...)`'s
promise — typed as returning `Promise<AuthResponse>`, but not
themselves `async`. A Zod parse failure throws _synchronously_, before
any promise is ever created or returned — so calling `login(badInput)`
threw straight out of the call expression instead of producing a
rejected promise. Every promise-shaped consumer (a mutation's
`onError`, `await ... catch`, this file's own
`expect(...).rejects.toThrow()` test) would never see it as a
rejection; the first one to actually trip over it was the test
asserting registration validation. Fixed by marking both functions
`async` — the one-word change that makes a synchronous throw inside
automatically become a promise rejection, matching `fetchCurrentUser`
(already `async`) right next to it. Caught by the test, not inspection
— a real argument for actually running MSW-backed tests rather than
reasoning about the promise chain by eye.

## A real RTL query gotcha: the `*` on a required label is not hidden from `getByLabelText`

`Input`'s `required` prop renders a visually-decorative `<span
aria-hidden="true"> *</span>` inside the `<label>`. `aria-hidden`
excludes it from the _accessible name_ an actual screen reader would
announce, but React Testing Library's `getByLabelText` by default
matches against the label element's raw `textContent` — which does not
respect `aria-hidden` — so `getByLabelText('Email')` failed to find a
label whose literal text content is `"Email *"`. Fixed in the test
files by matching a regex prefix (`getByLabelText(/^Email/)`) rather
than loosening the component itself — the component's accessibility
behavior is correct; the query needed to account for RTL's specific
matching algorithm, not the other way around.

## `?from=` validated against open redirect, and against redirect loops specifically

`app/auth/safeRedirect.ts`'s `resolveSafeRedirect` is the one gate
every `?from=` value passes through before reaching `<Navigate>` —
covered in detail in authentication.md's "Routing behavior". Two
things worth calling out as decisions, not just implementation: it
requires a _parsed_ same-origin check (`new URL(value,
window.location.origin).origin === window.location.origin`), not just
a string prefix check, since a prefix check alone (`startsWith('/')`)
still accepts a protocol-relative `//evil.example.com`; and it takes an
explicit `excludePaths` list used specifically to reject `/login`/
`/register` themselves, which a purely syntactic same-origin check
would have no reason to flag but which would otherwise let a crafted
`/login?from=/login` bounce an authenticated visitor back to `/login`
forever.

## `RequireAuth` fails closed on a query error, not just on `null`

`useCurrentUser()` can resolve to `null` (confirmed anonymous — the
server said `401`) or land in `isError` (the check itself failed —
network error, `5xx`). `RequireAuth` treats both identically: redirect
to `/login`. Deliberately not finer-grained ("retry on error, redirect
only on null") — a route guard that can't positively confirm a session
exists must not render as if one does; failing open here would be the
wrong default for a security-relevant check, even though it means a
transient network blip briefly looks the same as being logged out.

## `RequireRole` renders an inline 403, not a redirect

A signed-in `STUDENT`/`LECTURER` who navigates to `/admin` sees an
honest "you don't have access to this page" message in place, rather
than being silently redirected to `/dashboard` or anywhere else. A
redirect here would read as a confusing dead link with no explanation;
an inline message is both more honest and strictly a UI/UX choice —
deleting `RequireRole` entirely would not change what the backend's
own `requireRole` middleware allows a non-admin session to do against
any API.

## `vite preview` needed its own `/api` proxy too

`playwright.config.ts` targets `vite preview` (the production build),
not the dev server — but only `server.proxy` existed in
`vite.config.ts`; `preview` has no such default and every API call from
an e2e run against the built preview would 404 against the static file
server instead of reaching the API. Added `preview.proxy` mirroring
`server.proxy` exactly (same target, same `changeOrigin`) — this also
makes `vite preview` a closer match for the real nginx-fronted
production topology, not just an e2e-testing convenience.

## Out of scope for Task 05C.1 (confirmed against the task brief)

- No Resource API integration, and the Library Explorer was not
  switched to `HttpResourceRepository` — still the Task 04 mock.
- No bookmarks, no collections, no password reset, no email
  verification.
- No Redux/RTK Query; TanStack Query was not replaced.
- No CSS framework introduced; all new UI uses the existing design
  system and CSS Modules.
- `apps/api` was not modified — including the CSRF-binding finding
  documented in authentication.md, which would require a backend
  middleware-ordering change this task's scope excludes.

---

# Task 05C.2 — real Resource API integration

Full write-up of the frontend repository boundary, query key strategy,
auth-aware caching, retry policy, and known limitations lives in
[`docs/domain/resources.md`](../domain/resources.md)'s "Frontend
integration (Task 05C.2)" section — this covers decisions outside that
doc's scope, plus what was found or broke along the way.

## `resourceRepository` always resolves to `HttpResourceRepository`; the mock never backs production

The task brief's "production must not silently fall back to mocks when
the backend fails" is enforced structurally, not by a try/catch: there
is no fallback code path at all. A real backend failure surfaces as a
genuine thrown `ApiError`/network error through the query's `isError`
state (see `features/library/resourceErrors.ts`), never an automatic
swap to fixture data. `mockResourceRepository` stays exported and used
directly by tests and by the MSW handlers that back them — never by
`resourceRepository` itself.

## A latent `useCurrentUser` retry bug, found under this task's new lens

Task 05C.1 set `useCurrentUser`'s `retry: false` deliberately, to avoid
a transient check from hanging the UI. Task 05C.2's explicit
"distinguish auth failure from temporary backend unavailability"
requirement reframed that same choice as a bug: a `5xx`/network blip on
`/auth/me` would immediately flip `isError: true`, and `RequireAuth`
treats that identically to "confirmed logged out" — bouncing a validly
authenticated user to `/login` on nothing more than a dropped
connection. Fixed with a shared, conditional retry policy
(`shared/api/retryPolicy.ts`'s `shouldRetryTransientFailure`) applied to
both `useCurrentUser` and the two resource hooks, rather than a one-off
patch to just one of them. A regression test for the fixed behavior was
added to `useCurrentUser.test.tsx` (it previously only covered the
active-session and anonymous cases, never the "backend hiccuped"
case).

## A real Node 24+/jsdom/Vitest incompatibility, surfaced by AbortSignal propagation

Threading an `AbortSignal` from TanStack Query through to `fetch`
(`shared/api/httpClient.ts`) — needed for the task's "AbortSignal
propagation where supported" requirement — immediately broke every
existing `LibraryPage.test.tsx`/`ResourceDetailsPage.test.tsx` test:
Node 24+'s native `fetch` validates `RequestInit.signal` against its
own internal `AbortSignal` implementation, and Vitest's jsdom
environment installs jsdom's own `AbortController`/`AbortSignal`
polyfill as the global one — a signal created through it fails that
check with `TypeError: RequestInit: Expected signal ("AbortSignal {}")
to be an instance of AbortSignal`, reproducible with a bare `new
Request(url, { signal: new AbortController().signal })`, no MSW
involved. This is the same general class of jsdom/Node `fetch`
incompatibility Task 01 already hit and worked around architecturally
(splitting `router.tsx`/`routes.tsx` so `createBrowserRouter().initialize()`
never runs in unit tests — see Task 01's "Testing strategy" entry
above) — but architectural avoidance wasn't an option here, since the
task explicitly requires real signal propagation. The actual fix
(jsdom not clobbering these globals at all) lands in Vitest 4, still in
beta and out of reach without an unplanned major-version upgrade of a
test-tooling dependency, which is exactly the kind of change Task
05C.1 already declined to make for MSW's own peer-dependency
constraints. Instead, `test/setup.ts` wraps `globalThis.fetch` — after
MSW's own interceptor installs itself, so every call still reaches
MSW's matching logic — stripping `signal` before it ever reaches
`fetch`'s native validation. This is confined entirely to test
infrastructure; `shared/api/httpClient.ts` is unmodified and still
passes the signal through for real. The one behavior this shim
necessarily can't verify under Vitest is literal request cancellation
reaching the network layer — covered instead by a unit test that spies
directly on `fetch` to confirm the signal reaches the call
(`httpResourceRepository.test.ts`) and by live browser verification
(see the Task 05C.2 completion report).

## Mock pagination changed to match the backend, not the other way around

`mockResourceRepository` used to clamp `page = Math.min(query.page,
totalPages)`; the real backend (Task 05B) always echoes back the
requested page with an empty `items` array instead. The task brief's
instruction to "resolve documented mock-vs-backend pagination
differences consistently" was read as: the backend is authoritative
now that one exists, so the mock was changed to match it, not the
reverse — also updating the one test
(`mockResourceRepository.test.ts`) that encoded the old clamping
behavior. `LibraryPage` itself handles the resulting "stale/shared link
lands past the end of the current result set" case by self-correcting
the URL to the last real page rather than rendering a momentarily
misleading empty-library state.

## CSRF/session middleware review: no backend change

A focused, read-only review of `apps/api/src/middleware/csrf.ts`,
`validateOrigin.ts`, and the auth routes (per the task brief's explicit
"do not modify backend authentication middleware without a
demonstrated issue") found nothing rising above informational
severity, and nothing new: the documented-but-dormant
`authSessionId`-based CSRF session-binding fallback (`authentication.md`,
"API client and CSRF handling on the frontend") is confirmed dead code
by middleware ordering in `app.ts` (global CSRF validation runs before
any route-level auth middleware populates `req.authSessionId`), but the
double-submit token's core guarantee doesn't depend on it — the
HttpOnly secret cookie being unforgeable cross-origin is what actually
does the work. CSRF cookies are also never rotated on login/logout,
same root cause, same non-issue for the same reason. `validateOrigin`
and the CSRF double-submit check were confirmed to cover genuinely
different gaps (origin spoofing vs. proof of same-origin script
access) and remain independently effective. No backend code changed as
a result of this review.

## Out of scope for Task 05C.2 (confirmed against the task brief)

- No resource create/edit/delete UI — `ResourceRepository` still only
  has `list`/`getById`.
- No bookmarks, no collections, no book loans, no new business
  entities.
- No Redux/RTK Query/custom duplicate cache; TanStack Query remains the
  only auth/resource state store.
- No CSS framework; no rewriting the app shell or authentication.
- `apps/api` was not modified, including after the CSRF/session review
  above — no demonstrated issue meant no change, per the task's own
  instruction.

## `capabilities: { canEdit, canDelete }` added to `ResourceDetailSchema`, not `ownerId` (Task 05C.3)

The task brief is explicit that the backend must never expose `ownerId`
in a Resource DTO, and that the frontend must never guess ownership
from `creatorName`/email/`displayName`. The only way a client can
legitimately learn "can I edit/delete this specific resource" is for
the backend to compute it and say so directly. `resourceCapabilities()`
(`apps/api/src/modules/resources/resource.policy.ts`) reuses the
existing `canModifyResource` policy — unchanged, not duplicated — and
returns `{ canEdit, canDelete }` booleans, both always equal in this
codebase because edit and delete are the same authorization rule here.
Added only to `ResourceDetailSchema`, not `ResourceSummarySchema`: the
list view has no per-row management actions in this task, so adding it
there would be speculative surface a payload nothing renders.
`toResourceDetail`'s signature grew an `actor: Pick<PublicUser, 'id' |
'role'> | null` parameter rather than a full `PublicUser`, because
`getResourceById`'s read path only ever holds the narrower
`ActorContext` shape (`{ userId, role, groupIds }`), not a full fetched
user row — narrowing `Policy<Subject>`'s own actor parameter the same
way (`apps/api/src/modules/auth/policy.ts`) made this a non-breaking
change, since every existing caller already passes a full `PublicUser`,
which still satisfies the narrower structural type.

## Minimal `GET /courses` / `GET /groups` metadata endpoints added (Task 05C.3)

Task 05B explicitly deferred these (see "Tags are a folksonomy; Courses
and Groups are curated"), reasoning that nothing in the contracts or
frontend mock called for one yet. This task's course/group picker is
exactly that real consumer: the frontend's pre-existing `COURSES`
fixture (`shared/data/resources/courses.ts`) used fake ids (`cs101`,
`algo201`) that don't exist in the real database, a genuine
incompatibility confirmed by inspection, not assumed. Both endpoints
are read-only, unpaginated (the seed/admin-managed sets are small by
design), and gated `requireAuth()` + `requireRole('LECTURER', 'ADMIN')`
— a `STUDENT` has no create/edit flow that would ever need them. No
Group or Course CRUD was added; the brief's "no overengineering backend
metadata administration" ruled that out, and nothing downstream needs
it.

## One shared `ResourceForm`, with its own intermediate Zod schema (Task 05C.3)

The brief prefers one shared form component for create and edit over
two divergent implementations. `ResourceCreateInputSchema` (a strict
discriminated union) and `ResourceUpdateInputSchema` (a flat, fully
partial object) have genuinely different shapes and optionality rules,
and fighting React Hook Form's `zodResolver` against a discriminated
union mid-edit (while the user is still choosing a type) is a known
source of friction. `resourceFormSchema.ts` introduces
`ResourceFormValuesSchema` — a form-owned schema decoupled from both
contract schemas, with a `durationMinutes: string` field (not
`durationSeconds: number`, matching how a human types a duration) and a
`.superRefine` for the two cross-field rules (duration required by
type; restricted groups required when visibility is `RESTRICTED`).
`toCreateInput`/`buildUpdateInput` are the only two places that cross
back into the real contracts, at the actual submission boundary.

## PATCH diffing via React Hook Form's own `dirtyFields` (Task 05C.3)

`ResourceUpdateInputSchema` distinguishes an omitted field ("leave
unchanged") from an explicit `null` ("clear it") — Task 05B's own
documented semantic. `buildUpdateInput(values, dirtyFields)` reads RHF's
`dirtyFields` (not a value-equality diff against the original) to
decide which keys to include at all: a field the user never touched is
omitted outright; a field they touched and then cleared is sent as an
explicit `null`. `type` or `durationMinutes` changing always resends
`durationSeconds` as a pair — never one without the other — so the
backend's own cross-field invariant check (duration required/absent by
type) always sees a self-consistent patch, never a half-updated one
that would fail validation for a reason the user's actual edit didn't
cause.

## Lecturer-denied-editing is an in-page capability check, not a router guard (Task 05C.3)

`/library/new` is gated with `<RequireRole roles={['LECTURER',
'ADMIN']} />` at the router level — a pure role question with no
per-resource state to resolve. `/library/:resourceId/edit` cannot be
gated the same way: whether a given `LECTURER` may edit a given
resource depends on ownership, which only exists once that specific
resource has been fetched. `EditResourcePage` instead fetches the
resource and checks `data.capabilities.canEdit` itself, rendering an
inline "You don't have access to edit this resource" message — not a
redirect — mirroring `RequireRole`'s own established "inline message,
not redirect" precedent (see "`RequireRole` renders an inline 403, not
a redirect" above). This frontend check is purely a UX nicety; the
actual enforcement is the backend's `403` on the `PATCH` itself.

## No optimistic updates for the delete mutation (Task 05C.3)

The brief explicitly rules out unsafe optimistic updates for
destructive operations. `useDeleteResourceMutation` only invalidates
`['resources']` in `onSuccess` — the UI shows the resource as deleted
only after the server has confirmed it, never before. Verified both by
a dedicated hook test ("no invalidation while delete is still pending")
and by the delete confirmation dialog's own pending/disabled state,
which blocks a second submission until the first one resolves either
way.

## Courses/restricted-groups use the existing checkbox-grid pattern; tags use a new free-text chip input (Task 05C.3)

The brief forbids introducing a new component framework just for
multi-select. `FilterPanel.tsx`'s existing tag-checkbox-grid pattern
already solves "pick zero or more from a small, fixed, server-sourced
list" — reused as-is for course and restricted-group selection, both
small curated sets fetched from the new metadata endpoints. Tags are
different in kind, not just size: they're a folksonomy with
find-or-create semantics (see "Tags are a folksonomy; Courses and
Groups are curated") and no listing endpoint exists for them, so a
checkbox grid has nothing to enumerate. `TagInput` (new) is a free-text
chip editor instead — Enter/comma commits a tag, Backspace on an empty
input removes the last chip, and up to 12 unused tag names already seen
elsewhere are offered as one-click suggestion chips, without requiring
an exhaustive tag listing endpoint the backend has no reason to have.

## `beforeunload` guard, not an autosave system, for "prevent accidental data loss" (Task 05C.3)

The brief explicitly rules out a complicated autosave system while
still asking for data-loss prevention "where practical."
`ResourceForm` adds a native `beforeunload` listener for exactly as
long as RHF's `isDirty` is true — the lightest mechanism that satisfies
the requirement without introducing draft persistence, debounced saves,
or any new state machine. Confirmed working live in a real browser: an
attempted navigation away from a dirty, unsaved form triggered Chrome's
native "Leave site?" confirmation and blocked the navigation until
explicitly discarded.

## Out of scope for Task 05C.3 (confirmed against the task brief)

- No bookmarks, collections, physical book loans, or external
  Reel/Depot/Skill Map integrations.
- No rewriting of authentication or the app shell.
- No Redux/RTK Query; TanStack Query remains the only mutation/cache
  layer.
- No CSS framework.
- No Group/Course CRUD API — the new metadata endpoints are read-only,
  per "no overengineering backend metadata administration."
- No `/tags` listing endpoint — tags keep their existing find-or-create
  semantics with no enumeration API.
- `capabilities` was added only to `ResourceDetailSchema`, not
  `ResourceSummarySchema` — no per-row list-view management actions
  exist in this task.

## Root cause of leftover test-database rows: `afterAll` only disconnected, never reset (Task 05D)

The reported symptom — `academy_library_test` accumulating extra
Course/Group rows across sessions — traced to a real, demonstrated gap
in `auth.routes.test.ts`, `metadata.routes.test.ts`, and
`resources.routes.test.ts`: each resets every table in its own
`beforeEach` (correct — guarantees no test depends on what an earlier
test in the same file wrote), but each file's `afterAll` only called
`prisma.$disconnect()`, never `resetAllTables()` again. `beforeEach`
only protects the _next_ test in the _same_ file; nothing protected
whatever the very last test of the very last DB-touching file wrote,
since no later `beforeEach` in that run ever fired to clean it up.

Empirically confirmed **not** to depend on file-declaration or CLI
argument order: passing an explicit, reversed file order to `vitest
run` on the command line made no difference — Vitest's own sequencer
reorders files regardless (observed order: `resources.routes.test.ts`,
`auth.routes.test.ts`, `authorization.test.ts`,
`metadata.routes.test.ts`, then the non-DB files). This is exactly why
the bug looked intermittent: _which_ file's last test leaked wasn't
something a developer controlled by how they listed or ran the files.

Fix: each of the three files' `afterAll` now also calls
`resetAllTables()` before disconnecting — so whichever file genuinely
runs last, the database still ends up empty. Verified by running the
full suite twice consecutively, running the previously-affected file
(`metadata.routes.test.ts`) completely alone, and confirming
`academy_library_test` returns to zero rows in every table after each.
Not a rewrite of the test harness — the existing `resetAllTables()`
helper and `beforeEach` convention were already correct; this closes
the one missing bookend.

## Explicit code-level guard against resetting a non-test database (Task 05D)

`apps/api/vitest.config.ts` already hardcodes the test
`DATABASE_URL`, which is sufficient protection for a normal `pnpm
--filter api test` run — but it only protects callers that go through
that one config. `tests/helpers/db.ts`'s reset functions
(`resetAllTables`/`resetAuthTables`/`resetResourceTables`) now also
assert, at the top of each, that `DATABASE_URL` matches
`academy_library_test`/`academy_library_e2e` and that
`NODE_ENV !== 'production'`, throwing immediately otherwise. Added
specifically because Task 05D introduces a _second_ caller of these
functions outside Vitest entirely
(`apps/api/scripts/resetAndSeedDatabase.ts`, used by Playwright's
`globalSetup` — see below), which has no config-level pin of its own to
rely on. Verified directly: running the reset script with
`DATABASE_URL` pointed at `academy_library` (the real dev database)
throws immediately and leaves it untouched, confirmed via `psql`
before and after.

## Playwright E2E gets its own database, separate from the Vitest integration-test one (Task 05D)

`academy_library_test` (used by `pnpm --filter api test`) and
`academy_library_e2e` (used by Playwright) are now two different
databases on the same local Postgres instance — not a schema, not a
per-worker namespace, nothing more elaborate than a second `CREATE
DATABASE`. Chosen directly from the task brief's own suggested option
list ("dedicated test databases") specifically to satisfy "prevent API
tests and Playwright tests from interfering with one another": the API
suite truncates every table it touches on every run, which would
silently corrupt an E2E run (or a developer's live manual check — this
is exactly how a previous session's leftover "Zoology Staff" test row
ended up visible in a real browser) in progress against a shared
database. A separate database makes that interference structurally
impossible rather than a documented rule to remember not to violate.

A new script, `apps/api/scripts/resetAndSeedDatabase.ts` (wired to
`pnpm --filter api test:e2e:reset-db`), truncates then re-seeds
whatever database `DATABASE_URL` points at — reusing the existing
`resetAllTables()` and the existing, unmodified `db:seed` script rather
than duplicating either. It shells out to `db:seed` as a subprocess
specifically to avoid importing `prisma/seed.ts`'s internals: that file
runs its own `main()` at module-load time, so importing it directly
would run the seed twice. Playwright's `tests-e2e/globalSetup.ts` calls
this script automatically before any test runs, via `pnpm --filter
@academy-library/api test:e2e:reset-db` (resolved from the workspace
root regardless of `apps/web`'s own cwd) — so every E2E run starts from
an identical, known baseline without any manual `psql` step. Verified:
full suite run twice consecutively, 15/15 both times, database back at
exactly 12 resources after each.

## Prisma migration drift: empirically confirmed, and confirmed non-destructive in the one way that matters (Task 05D)

`schema.prisma`'s own comments already warned that `prisma migrate dev`
might propose dropping the hand-written, migration-SQL-only objects
(the `searchVector` GIN index, the `tags.name` trigram index, the
`users_email_lower_key` functional index, the duration `CHECK`
constraint) as unrecognized drift. This task verified that warning
empirically rather than just re-stating it: applied all three existing
migrations to a disposable database (never the dev or test one, dropped
immediately after), then ran `prisma migrate dev --create-only` against
it with no other schema change pending.

Confirmed: Prisma proposes exactly three statements —
`DROP INDEX "resources_search_vector_idx"`,
`DROP INDEX "tags_name_trgm_idx"`, and
`ALTER TABLE "resources" ALTER COLUMN "searchVector" DROP DEFAULT` —
every time, regardless of what unrelated schema change triggered the
diff (this is a standing mismatch between the declared schema and the
real database, not something tied to any specific future edit). Neither
the `CHECK` constraint nor the `users_email_lower_key` functional index
nor the `pg_trgm` extension were ever proposed for removal — Prisma's
diff engine doesn't track CHECK constraints or extensions at all, and
doesn't recognize a functional/expression index as belonging to the
column it's built from, so those three stay invisible to it entirely.

Critically, actually _applying_ that generated migration (via `prisma
migrate dev`, which validates against a shadow database first) fails
immediately: Postgres itself rejects
`ALTER COLUMN "searchVector" DROP DEFAULT` with `column "searchVector"
of relation "resources" is a generated column`, and Prisma aborts
without touching the real database. So the actual risk is **not**
silent data loss — a developer hits a loud, immediate error and
nothing changes. The real risk is narrower but still worth guarding
against: if a developer, chasing that error, edited the generated
migration to remove just the offending `ALTER COLUMN` line (Postgres's
own error message even suggests a fix, `DROP EXPRESSION`, which only
compounds the confusion) while keeping the two `DROP INDEX` lines, _that_
migration would apply cleanly and silently drop both search indexes —
a real performance regression (slower, sequential-scan search; results
stay correct) that wouldn't error at all.

No schema or migration change was made as a result of this finding —
per the task brief, "if a safe migration strategy already exists,
document it instead of creating unnecessary changes." The existing
strategy already is safe in the way that matters most: CI and
production only ever run `prisma migrate deploy` (applies committed
migration files verbatim, never diffs or regenerates), so this risk is
confined to a developer's own local `prisma migrate dev` the next time
the schema changes. The concrete, now-verified remedy: if `migrate dev`
ever proposes touching `resources_search_vector_idx`,
`tags_name_trgm_idx`, or `searchVector`'s default, delete exactly those
lines from the generated migration file before applying it — the rest
of the generated diff (whatever unrelated change was actually intended)
is fine to keep.

## Playwright's `createMemoryRouter` works in this jsdom setup; `createBrowserRouter` still doesn't (Task 05D)

The existing "Testing strategy" note above says a data router can't be
mounted in unit tests at all, because `.initialize()` constructs a
`Request`/`AbortSignal` jsdom's polyfill rejects. Re-verified
empirically for Task 05D's `useBlocker`-based navigation guard (which
requires a real data router) rather than assumed: `createMemoryRouter`

- `RouterProvider` mounts and renders fine under this project's
  Vitest/jsdom setup — the original note is specifically about
  `createBrowserRouter`'s own `.initialize()` path, not every data
  router. A new `renderWithDataRouter` test helper
  (`apps/web/src/test/renderWithProviders.tsx`) wraps this for any test
  that needs it; `CreateResourcePage.test.tsx`, `EditResourcePage.test.tsx`,
  and `ResourceForm.test.tsx` all switched to it, since `ResourceForm`
  now calls `useBlocker` unconditionally and the classic `<MemoryRouter>`
  makes that throw ("useBlocker must be used within a data router").

A second, narrower instance of the _same_ underlying jsdom/Node24/
undici `AbortSignal` mismatch (previously documented only for this
app's own `fetch` wrapper — see Task 05C.2's "AbortSignal propagation"
entry) surfaced once an actual navigation was attempted inside a
mounted data router: `@remix-run/router`'s `startNavigation` →
`createClientSideRequest` constructs its own `new Request(url, {
signal })` internally, using an `AbortController` created in the same
jsdom realm, and hits the identical construction-time error. Fixed the
same way, in the same place, for the same documented reason: `test/
setup.ts` now also patches the global `Request` constructor to strip an
incompatible `signal`, alongside the existing `fetch` patch — not a new
category of workaround, the same one applied to a second call site.

## In-app navigation away from a dirty `ResourceForm` is now blocked, exempting the post-success redirect (Task 05D)

Confirmed the gap before fixing it: the existing `beforeunload`
listener only fires on an actual full-page unload (tab close, refresh,
typing a new URL) — never on a React Router client-side navigation
(a sidebar link, the page's own "Back to..." link, browser back/forward
while still inside the SPA), which bypasses it entirely and discards an
unsaved form with zero warning.

`useUnsavedChangesBlocker` (`features/library/`) wraps `useBlocker`,
exempting `historyAction === NavigationType.Replace` unconditionally —
both `CreateResourcePage` and `EditResourcePage` navigate away with
`{ replace: true }` specifically and only on a successful submission,
the one in-app navigation that must never be blocked. This declarative
condition was chosen over a prop/ref-based "did the mutation just
succeed" flag specifically to avoid a real ordering hazard: a flag set
from a `useEffect` reacting to an `isSubmitting` prop transition isn't
guaranteed to have committed before the parent's `onSuccess` callback
(which calls `navigate()`) runs in the same tick, and getting that race
wrong would mean occasionally blocking the exact navigation this
feature must never block. `historyAction` is evaluated by the router
itself at the moment of the navigation attempt, so there's no race to
get wrong. `UnsavedChangesDialog` composes the existing `Modal` +
`Button` primitives, matching `DeleteResourceDialog`'s established
pattern — Escape and the backdrop both resolve to "stay," never to the
discarding action. The existing `beforeunload` listener is unchanged
and still covers the browser/tab-close half this hook doesn't.

Known, accepted gap: `RequireAuth`'s own session-expiry redirect
(`<Navigate replace>` to `/login`) is also a `REPLACE` navigation, so it
is also exempt — a session expiring mid-edit silently discards an
unsaved form rather than warning first. Not addressed here: blocking a
forced logout redirect would leave the user staring at a form they can
no longer successfully submit anyway, a worse outcome than the silent
loss.

## `RequireAuth` shows a recoverable error on a session-check failure, not a `/login` redirect (Task 05D)

Re-examined the existing, deliberate "fails closed on a query error,
not just on `null`" decision (above) against this task's "transient
`/me` failures produce a recoverable error state rather than a
misleading logged-out redirect" requirement, and concluded these don't
actually conflict: the original decision's invariant is "never render
`<Outlet/>` without a confirmed session," not "always redirect to
`/login` specifically." `isError` (reached only after
`useCurrentUser`'s own `shouldRetryTransientFailure` retries are
exhausted — see Task 05C.2) now renders a `FullPageMessage` with a
Retry button instead of `<Navigate to="/login">`; `!user` with no error
(a confirmed `401`) still redirects exactly as before. `<Outlet/>` still
never renders in the `isError` branch — the security boundary is
unchanged, only which non-protected UI is shown for a transient
backend failure versus a confirmed logout. `FullPageMessage` gained an
optional `action` slot (a `ReactNode` rendered below the message) to
carry the Retry button — unused by `RequireRole`'s existing 403, which
has nothing to retry. The previously-existing test asserting the old
"redirects to /login on error" behavior was updated to assert the new
one, plus a new test confirming a successful retry recovers straight
into the protected content without ever visiting `/login`.

## Out of scope for Task 05D (confirmed against the task brief)

- No Collections, Bookmarks, or physical book loans.
- No Redis or queues.
- No Redux; TanStack Query remains the only mutation/cache layer.
- No rewriting of backend architecture — the Prisma migration review
  (above) concluded the existing `migrate deploy`-only CI/production
  strategy is already safe, and changed nothing about it.
- No redesign of existing pages — `UnsavedChangesDialog` and
  `RequireAuth`'s retry UI both compose existing `shared/ui/`
  primitives exactly as `DeleteResourceDialog`/`RequireRole` already
  do, not new visual patterns.
