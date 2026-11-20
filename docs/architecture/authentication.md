# Authentication & authorization

Task 05A introduced the database foundation for users, database-backed
server-side sessions, and the authorization infrastructure (role-based
middleware, an object-level policy foundation). Task 05B built the
Resource domain on top of it (see docs/domain/resources.md). **Task
05C.1 is the first task to touch `apps/web`**: real login/registration
pages, session-aware routing, and role-aware navigation, consuming the
backend exactly as Tasks 05A/05B left it — nothing in this document's
backend sections changed. The backend-focused sections below are
unchanged from Task 05A/05B; "Frontend authentication (Task 05C.1)" at
the end covers the new client-side half.

## Architecture: why opaque, database-backed sessions, not JWT

- **A session can be revoked instantly.** Logout, an admin disabling an
  account, or a detected compromise all need "this credential stops
  working right now" — a self-contained JWT can't be invalidated before
  its own expiry without a second system (a blocklist) that erases the
  main argument for using a JWT in the first place.
- **The token itself carries no information.** It's a 256-bit random
  value (`crypto.randomBytes(32)`, base64url-encoded — see
  `src/lib/sessionToken.ts`) with no embedded claims to forge, replay
  across a role change, or leak a user id from. The server is the only
  place that knows what it means.
- **Only a hash of the token is ever stored.** `hashSessionToken` is
  SHA-256 over the raw token — deliberately _not_ Argon2id (see
  "Password hashing" below for why that distinction matters) — so a
  stolen database dump yields `tokenHash` values, not usable session
  tokens.

## Session lifecycle

| Property           | Value                                                                                            | Where                                            |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Lifetime           | 720 hours (30 days), fixed from creation                                                         | `SESSION_TTL_HOURS` env var, `src/config/env.ts` |
| Renewal            | None — absolute expiry, not sliding                                                              | By design; see below                             |
| Activity tracking  | `lastUsedAt`, updated best-effort on each validated request                                      | `session.service.ts`'s `validateSessionToken`    |
| Expiry enforcement | Checked on every request; expired rows are deleted opportunistically on the read that finds them | same                                             |
| Revocation         | Row deletion — immediate on the next check, not eventual                                         | `revokeSessionByToken` / `revokeSessionById`     |

**Why a fixed 30-day lifetime instead of sliding expiration:** a sliding
window ("extend on every request") means a session that's merely idle,
not actively used, can still be alive indefinitely as long as _anything_
occasionally touches it — including an attacker who stole the cookie
and is quietly keeping it alive. A fixed expiry gives a hard upper bound
on how long a compromised-but-undetected token remains useful, at the
cost of the user having to log in again after 30 days regardless of
activity. 30 days was chosen as a reasonable balance for a product in
this stage (no sensitive financial data, an educational resource
platform) — revisit downward if a future task introduces anything more
sensitive.

**Session fixation** is prevented structurally, not by a special check:
the server never accepts a client-supplied session identifier as input
to anything. A session is only ever created as the _result_ of a
successful login (`POST /auth/login`), with a freshly
`crypto.randomBytes`-generated token — there is no "upgrade this
existing (possibly attacker-planted) identifier to an authenticated one"
code path to protect against. As an additional hygiene step, login also
revokes whatever session the request's cookie already pointed to (if
any) before issuing the new one, so re-authenticating never leaves an
old, still-valid token behind alongside the new session.

**No cleanup job yet.** Expired sessions are only deleted when a later
request happens to try to validate them. A user who logs in once and
never returns leaves one dead row in the `sessions` table forever. This
is a correctness non-issue (expired sessions are never treated as
valid) and a storage-hygiene recommendation for Task 05B: a scheduled
`DELETE FROM sessions WHERE "expiresAt" < now()` job, using the
existing `@@index([expiresAt])`.

## Password hashing

Argon2id via `@node-rs/argon2` (napi-rs bindings to the reference Rust
`argon2` crate — a well-maintained implementation, not hand-rolled).
Argon2id is explicitly named in `src/lib/password.ts` even though it's
already the library's default, so the choice is visible in code, not
implicit. The library's default cost parameters — memory cost 19 MiB,
time cost 2, parallelism 1 — match OWASP's published Argon2id baseline
recommendation and are not overridden.

**Why session tokens are hashed with SHA-256, not Argon2id, while
passwords use Argon2id:** Argon2id's deliberate slowness defends against
brute-forcing a _low-entropy, human-chosen_ secret (a password) once an
attacker has the hash. A session token is already a uniformly random
256-bit value — there is nothing for a slow, memory-hard hash to defend
against that the token's own entropy doesn't already provide, and
session validation happens on _every_ authenticated request, where a
deliberately slow hash would add real, pointless latency.

## Cookie policy

All cookies (the session cookie, and the two CSRF-related cookies
below) share one set of attributes, defined once in `src/lib/cookies.ts`:

- **`HttpOnly`** — never readable from JavaScript.
- **`SameSite=Lax`** — sufficient, not merely assumed sufficient, given
  the deployment shape this app assumes: both local dev (via the Vite
  dev-server proxy, `apps/web/vite.config.ts`) and the Docker
  Compose/production shape (via the nginx reverse proxy,
  `infra/docker/web/nginx.conf`) put the browser and the API on **one
  origin** — the browser never makes an actual cross-site request to
  this API at all in the intended topology. CSRF protection (below) is
  still layered on top regardless; `SameSite` is not treated as
  sufficient CSRF protection on its own, only as a sensible scope
  restriction on the cookie itself, exactly as the Task 05A brief asked.
- **`Path=/`** — explicit, not left to request-path-derived defaults.
- **`Secure`**, tied to `NODE_ENV === 'production'`: this assumes
  `NODE_ENV=production` is only ever set for a deployment actually
  served over HTTPS (directly, or via a TLS-terminating reverse proxy —
  `app.ts` already sets `trust proxy` for that case). **The bundled
  Docker Compose stack is a local topology mirror, not a TLS-terminated
  deployment** — it sets `NODE_ENV=production` for container-parity
  reasons, over plain HTTP. Never expose that compose stack to the
  public internet as-is; see "Production security limitations" below.

**Cross-origin deployment** (frontend and API genuinely on separate
origins, no reverse proxy) is explicitly not the default this app is
tuned for, and the recommended free-hosting topology
(docs/deployment/free-hosting.md) avoids it entirely via a Vercel
rewrite that makes the API appear same-origin to the browser — no
cookie/CORS reconfiguration needed beyond adding the Vercel domain to
`CORS_ORIGIN`. For the deliberately-unproxied alternative (the frontend
calling the API's own, different origin directly), Task 08 added two
paired, explicit opt-ins rather than a silent assumption:

- **`COOKIE_SAME_SITE=none`** (`apps/api/src/config/env.ts`) — switches
  every cookie this API sets from `SameSite=Lax` to `SameSite=None`, and
  forces `Secure` on regardless of `NODE_ENV` (browsers reject
  `SameSite=None` without `Secure`, so this fails loud over plain HTTP
  rather than silently dropping the cookie).
- **`VITE_API_BASE_URL`** set to the API's full, absolute origin
  (`apps/web/src/shared/api/httpClient.ts`) — the frontend derives its
  fetch `credentials` mode from this same variable: a relative path
  (the default) stays `'same-origin'`; an absolute `http(s)://` URL
  switches to `'include'` automatically, so the two can never drift out
  of sync with each other.

`CORS_ORIGIN` still needs the frontend's real origin either way (the
existing `cors({ origin: corsOrigins, credentials: true })` config,
never a wildcard `*` together with `credentials: true`, which browsers
reject anyway). Choosing this path is a deliberate decision for whoever
deploys this that way — the security properties discussed above change
accordingly — not something this app defaults to.

## CSRF strategy

A second, independent layer on top of `SameSite=Lax`, using
`csrf-csrf`'s signed double-submit cookie pattern (`src/middleware/csrf.ts`):
an HttpOnly "secret" cookie plus a plaintext token the client must echo
back via the `x-csrf-token` header on every state-changing request.
Stealing the plaintext token alone (e.g. from a response an attacker
can read) isn't enough without the HttpOnly cookie; stealing the cookie
would need an XSS vulnerability, since it's HttpOnly.

- `GET /api/v1/auth/csrf-token` issues the token/cookie pair. A client
  (once a real frontend exists — Task 05A builds none) calls this once
  and echoes the token on every subsequent `POST`/`PATCH`/`DELETE`.
- Before login, there's no session to bind the token to, so
  `ensureCsrfScope` establishes a dedicated anonymous per-browser
  identifier (its own small HttpOnly cookie) the first time any request
  needs one. The intent was for the real session id to take over after
  login — **this does not currently happen** (confirmed by both a Task
  05C.1 review and an independent Task 05C.2 re-review): `csrfProtection`
  is mounted globally in `app.ts` before the `/api/v1` router, so
  `req.authSessionId` is never populated yet when CSRF validation runs,
  and the anonymous per-browser identifier is what every token actually
  binds to, authenticated or not. See "API client and CSRF handling on
  the frontend" below for the full analysis and why this isn't a live
  vulnerability.
- `GET`/`HEAD`/`OPTIONS` are exempt (`ignoredMethods`) — reading data
  never needs a CSRF token.

**`validateOrigin` is a separate, independent third layer**
(`src/middleware/validateOrigin.ts`), not redundant with CORS or the
CSRF token: CORS only controls whether a _browser_ is allowed to read a
cross-origin response via script — it does not stop the request from
reaching this server at all, so a non-browser client ignores it
entirely. For every state-changing request, `validateOrigin` instead
checks that the `Origin` header (falling back to `Referer`) names one of
this API's configured origins — a real browser sends `Origin` on every
unsafe-method request, same-origin or not, specifically so servers can
do this. A request with a missing or disallowed origin is rejected
before any CSRF-token work even happens.

## Role model

Three roles, matching `apps/web/src/shared/config/roles.ts`'s
`UserRole` exactly (`STUDENT`, `LECTURER`, `ADMIN`) and the Prisma
`Role` enum — one set of string values, even though the frontend, the
Prisma schema, and `packages/contracts` each declare their own type for
it. Two statuses: `ACTIVE`, `DISABLED`.

- **`POST /auth/register` can only ever create a `STUDENT`/`ACTIVE`
  account.** `RegisterInputSchema` is `.strict()` — a request body
  containing a `role` or `status` key is rejected outright (400), not
  silently stripped — and `createStudentUser` (`user.repository.ts`)
  has no parameter for either value at all. There is no code path, not
  just a missing check, by which a registration request can produce a
  `LECTURER` or `ADMIN` account, or a `DISABLED` one.
- **The only way to create a `LECTURER`/`ADMIN` account is the
  development seed script** (or direct database administration) — see
  "Development accounts" below.
- **Authorization decisions happen server-side, from the
  database-backed session's role** — `requireRole` (`auth.middleware.ts`)
  reads `req.authUser.role`, which was populated by resolving the
  session cookie against the database, never from anything a client
  claims about itself. Task 03's frontend role-preview mechanism
  (`app/dev/RoleProvider`) — a dev-only UI toggle with no bearing on
  what the server enforced — was removed in Task 05C.1 once real
  authentication existed to replace it with; see "Frontend
  authentication" below for what the frontend now does instead.
- **`requireAuth`/`optionalAuth`/`requireRole`** are the three
  middleware this task provides; a reusable, generic **object-level
  policy foundation** (`src/modules/auth/policy.ts`) exists for later
  tasks to build resource-ownership checks on (`hasRole`, `ownedBy`,
  `anyOf`, `allOf`, `authorize`) — none of it is tied to a Resource
  model, since none exists yet.

## API endpoints (`/api/v1/auth`)

| Method & path     | Auth required              | Notes                                                                                                  |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /csrf-token` | No                         | Issues the CSRF token/cookie pair                                                                      |
| `POST /register`  | No (CSRF + origin checked) | Always `STUDENT`/`ACTIVE`; 409 on duplicate email; no auto-login; 403 if `REGISTRATION_ENABLED` is off |
| `POST /login`     | No (CSRF + origin checked) | Sets the session cookie; 401 generic for bad credentials, 403 for a disabled account                   |
| `POST /logout`    | No — idempotent            | Revokes the current session if any, clears the cookie, `204`                                           |
| `GET /me`         | Yes                        | Returns the current `PublicUser`; `401` if unauthenticated                                             |

All request/response shapes are Zod schemas in
`packages/contracts/src/auth.ts` (`RegisterInputSchema`,
`LoginInputSchema`, `PublicUserSchema`, `AuthResponseSchema`,
`CsrfTokenResponseSchema`) — never a raw Prisma `User` or `Session`
serialized directly. `toPublicUser` (`user.repository.ts`) is the single
function that turns a Prisma `User` into the DTO a client is allowed to
see; it is the only place `passwordHash` could leak from, and it never
includes it.

**Registration does not auto-login.** A successful `POST /register`
returns the created user with `201`, but sets no session cookie — the
client calls `POST /login` separately. This keeps "an account exists"
and "this browser is authenticated" as two distinct, individually
reasoned-about events, and avoids ambiguity about whether a would-be
fixation-adjacent scenario (a pre-existing cookie at registration time)
needs special handling.

**Not implemented, and deliberately not pretended to be:** password
reset and email verification. Both are real requirements before any
public launch of this product — see "Production security limitations."

## Database schema

```prisma
enum Role { STUDENT LECTURER ADMIN }
enum UserStatus { ACTIVE DISABLED }

model User {
  id, email, passwordHash, displayName, role, status, createdAt, updatedAt
  sessions Session[]
}

model Session {
  id, userId, tokenHash, expiresAt, createdAt, lastUsedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- **Case-insensitive email uniqueness** is enforced by a hand-written
  **functional unique index** on `lower(email)`
  (`users_email_lower_key`, added via raw SQL in the
  `add_users_and_sessions` migration) — not a `citext` column, and not
  the `postgresqlExtensions` preview feature, to avoid depending on a
  Prisma capability that hasn't reached GA as of the Prisma version
  pinned here. The application always normalizes (trims + lowercases)
  email before writing or querying (`normalizeEmail`,
  `user.repository.ts`), so the index is a DB-level safety net, not the
  primary query path — no raw SQL appears anywhere in the application
  code itself.
  - **Known sharp edge:** this index isn't declared in `schema.prisma`
    (the schema DSL has no expression-index syntax), so a future
    `prisma migrate dev` run may propose dropping it as unrecognized
    "drift." Never accept such a migration without checking it isn't
    removing this constraint.
  - A consequence of the same choice: `email` is not a
    Prisma-declared-`@unique` field, so Prisma Client has no
    `findUnique({ where: { email } })` — only `findFirst` (see
    `user.repository.ts`'s `findUserByEmail`). This is a deliberate
    trade of a small Prisma-Client convenience for the correct DB-level
    constraint.
- **`Session.userId` has `onDelete: Cascade`** — deleting a user removes
  their sessions; there is no meaningful state for a session to hold
  once its user is gone.
- **No unnecessary PII.** `Session` carries no IP address, user agent,
  or device label — just enough to validate and revoke a token and show
  "last used."
- Explicit indexes: `@@index([userId])` (Postgres does not
  auto-index foreign key columns the way some other databases do — this
  is required, not redundant), `@@unique([tokenHash])`, and
  `@@index([expiresAt])` (for the future cleanup job mentioned above).

## Migration strategy

Two migrations: the pre-existing Task 01 `20261118161902_init`
(`SchemaProbe`, untouched — **previously applied migrations are never
rewritten**) and the new `20261118204807_add_users_and_sessions`, which
both drops `SchemaProbe` (its purpose — proving the Prisma→Postgres
pipeline — is now served by real models) and adds `User`/`Session`
(including the hand-added functional index described above). Both
migrations apply cleanly to a fresh database and to an existing Task
01 database that already ran the init migration — `prisma migrate
deploy` only ever applies migrations it hasn't seen yet, by migration
history, not by diffing current schema state.

Local development continues to use `pnpm db:migrate` (`prisma migrate
dev`, generates and applies); Docker/CI/production use `pnpm
db:migrate:deploy` (`prisma migrate deploy`, applies existing
migrations only, exactly as before this task) — the `migrate` Compose
service (Task 01) already runs this, unchanged.

## Development accounts

`pnpm db:seed` (`apps/api/prisma/seed.ts`) creates one account per role:

| Role     | Email                   | Default password                                          |
| -------- | ----------------------- | --------------------------------------------------------- |
| STUDENT  | `student@academy.test`  | `DevPassword123!` (override via `SEED_STUDENT_PASSWORD`)  |
| LECTURER | `lecturer@academy.test` | `DevPassword123!` (override via `SEED_LECTURER_PASSWORD`) |
| ADMIN    | `admin@academy.test`    | `DevPassword123!` (override via `SEED_ADMIN_PASSWORD`)    |

- **Idempotent** — looks each account up by (normalized) email first and
  updates it in place rather than duplicating it; safe to run repeatedly
  (including via `prisma migrate reset`, which auto-invokes it).
- **Refuses to run with `NODE_ENV=production`** — exits non-zero
  immediately rather than seeding known, documented passwords into a
  production-configured environment.
- This is the _only_ place in the codebase that creates a
  `LECTURER`/`ADMIN` account — see "Role model" above.
- `prisma db seed` (and anything that invokes it, like `prisma migrate
reset`) must be run through a pnpm/npm-script context
  (`pnpm exec prisma db seed`, or just `pnpm db:seed` directly) so
  `tsx` resolves from `node_modules/.bin` — running the bare
  `prisma` binary directly without that PATH context fails with
  `spawn tsx ENOENT`.

## Request security

- **Helmet**, default configuration (`app.use(helmet())`) — the
  defaults (a baseline CSP, `X-Content-Type-Options`, etc.) are
  appropriate for a JSON API that serves no HTML of its own; nothing
  here needed loosening or tightening for this task.
- **Body size limits**: unchanged from Task 01, `express.json({ limit:
'1mb' })` / `express.urlencoded({ limit: '1mb' })` — generous enough
  for a registration/login payload, far short of enabling a
  body-size-based DoS.
- **Strict Zod validation** on every auth request body
  (`RegisterInputSchema`/`LoginInputSchema`, both `.strict()`).
- **Rate limiting** on `POST /register` and `POST /login`
  (`src/middleware/rateLimit.ts`): 20 requests per 15 minutes, keyed by
  IP (respecting `trust proxy`). This throttles credential-guessing and
  registration spam from one network — it is explicitly **not** account
  lockout (it doesn't slow down a distributed attempt against one
  specific account) and explicitly **not** multi-instance-safe (see
  "Known limitations").
- **Redaction in logs**: `pino-http`'s `redact` config
  (`app.ts`) censors `req.headers.cookie`, `req.headers.authorization`,
  the `x-csrf-token` header, `res.headers["set-cookie"]`, and
  `req.body.password` — a session token, CSRF secret, or password can
  never appear in a log line, even by accident.
- **No leaking database errors**: the shared `errorHandler` only ever
  returns `"Internal server error"` with no detail for anything it
  doesn't explicitly recognize (Zod validation errors, `AppError`s, and
  the CSRF library's `EBADCSRFTOKEN` error are the three recognized
  shapes) — a raw Prisma error's message/stack is logged server-side,
  never sent to a client.
- **Request IDs and structured logging** were already in place from
  Task 01 and are unchanged.

## Known limitations and security risks

- **Rate limiting is in-memory and per-process.** The moment this API
  runs as more than one instance/replica, each gets its own 20-per-15-
  minutes counter — an attacker spread across instances behind a
  round-robin load balancer effectively gets N× the intended limit.
  Before scaling horizontally, swap `express-rate-limit`'s default
  store for a shared one (e.g. `rate-limit-redis` against a real Redis
  instance).
- **No account lockout.** Rate limiting is IP-based, not
  account-based — a distributed attacker guessing one specific
  account's password from many IPs isn't meaningfully slowed. A
  recommended Task 05B addition: track failed-attempt counts per
  account and temporarily lock/delay after a threshold.
- **No password reset, no email verification.** Both are genuine
  requirements before any public production launch — a user who
  forgets their password currently has no self-service recovery path,
  and a registered email is never confirmed as reachable/owned by the
  registrant. Until either exists, `POST /auth/register` is gated by
  `REGISTRATION_ENABLED` (`src/config/env.ts`): unset, it's on in
  development/test and **off by default in production** — a deployment
  that forgets to set it fails safe rather than fails open. An operator
  who does want public self-registration on a given deployment (e.g. a
  low-stakes public demo) sets `REGISTRATION_ENABLED=true` explicitly,
  accepting the abuse-without-recovery tradeoff described above. With
  registration disabled, the endpoint still exists and still accepts
  requests (so rate limiting still applies to them) but returns a `403
FORBIDDEN` with a message explaining why, rather than 404ing in a way
  that would look like a routing bug.
- **No scheduled session cleanup job.** Expired rows are deleted lazily
  on read, not proactively — harmless for correctness, a storage-growth
  consideration at real scale (see "Session lifecycle" above).
- **The bundled Docker Compose stack is not a real production
  deployment.** It sets `NODE_ENV=production` for container-topology
  parity, but runs entirely over plain HTTP with no TLS termination —
  `Secure` cookies are still correctly issued (since they're tied to
  `NODE_ENV`), which means they will **not** round-trip to a plain-HTTP
  client, by design. A real production deployment must terminate TLS
  (directly or via a reverse proxy/load balancer with `X-Forwarded-Proto`
  and `trust proxy` configured, both already anticipated) before this
  is internet-facing.
- **`package.json#prisma` seed configuration is deprecated** as of the
  Prisma version pinned here (removal planned for Prisma 7, in favor of
  a `prisma.config.ts` file) — still fully functional today, flagged
  here so the eventual migration isn't a surprise.

## Frontend authentication (Task 05C.1)

Real login/registration pages and session-aware routing in `apps/web`,
consuming exactly the backend above — no new endpoint, field, or
cookie behavior was added or assumed that the backend didn't already
implement.

### Frontend session state

There is no separate auth context/store. `features/auth/api/useCurrentUser.ts`
wraps a single `useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })` —
every consumer (route guards, the header/profile menu, the sidebar,
`SettingsPage`) calls this same hook directly, so TanStack Query's own
cache (keyed on `['auth', 'me']`) _is_ the one source of truth. This
was a deliberate choice, not an oversight: a second, parallel
"AuthContext" holding a copy of the same user object would be exactly
the kind of duplicate cache the task brief warns against, and would
raise the question of which one is authoritative when they disagree
(e.g. mid-logout).

- `fetchCurrentUser` (`features/auth/api/authApi.ts`) turns a `401` from
  `GET /me` into a successful `null` result, not a thrown error —
  "anonymous visitor" is an expected, steady state for this query, not
  a failure. Any other failure (network error, `5xx`) still throws, so
  a genuine problem surfaces as `isError`, distinct from "logged out".
- `useLoginMutation`/`useRegisterMutation`/`useLogoutMutation`
  (same directory) are the only three places the `['auth', 'me']` cache
  is written from the client side:
  - **Login** writes the response's `user` directly via `setQueryData`
    — the login response already _is_ an `AuthResponse`, so refetching
    `/me` immediately afterward would just confirm what the response
    already said.
  - **Register** does not touch this cache at all — matches the
    backend's "registration does not auto-login" (see "Registration
    does not auto-login" above).
  - **Logout** calls `queryClient.clear()` (not just resetting the one
    key) and then `setQueryData(['auth', 'me'], null)` — clearing the
    whole cache is what guarantees no later task's resource/data
    queries can carry a previous user's data into the next person's
    session on a shared browser; re-setting the auth key immediately
    after gives every still-mounted component a correct, synchronous
    `null` rather than sitting in a brief "undefined" gap.
- `retry: false` on `useCurrentUser` — a `401` isn't transient and
  `fetchCurrentUser` already turns it into a successful `null`, so this
  mainly affects genuine network/server failures, where auto-retrying
  an authentication check isn't appropriate either.
- `refetchOnWindowFocus: true` on `useCurrentUser` specifically,
  overriding this app's global default (`false`, `app/queryClient.ts`)
  — the one place a stale session gets a chance to notice it expired
  without polling: returning to a backgrounded tab re-checks `/me`.

### Routing behavior

Three small components in `app/auth/`, composed into the existing
route tree (`app/router/routes.tsx`) as additional layout-route
wrappers — no change to `createBrowserRouter`, route-level lazy
loading, or any existing `errorElement`:

- **`RequireAuth`** wraps the entire authenticated shell (the
  `AppLayout` branch). Renders a full-page spinner while
  `useCurrentUser()` is loading (this is what prevents a flash of
  protected content before the session check resolves), redirects to
  `/login?from=<encoded current path>` if the result is `null` _or_
  `isError` (failing closed — if the check can't positively confirm a
  session, the guard treats that the same as "no session"), otherwise
  renders `<Outlet/>`.
- **`RequireRole`** wraps the `/admin` branch specifically
  (`roles={['ADMIN']}`). Only ever reached from inside `RequireAuth`'s
  subtree, so a user is already confirmed to exist; it renders an
  honest inline "you don't have access" message for a signed-in
  non-admin, rather than silently redirecting somewhere that would look
  like a dead link. This is UI-only, same as the old dev role preview
  was — deleting this component would change nothing about what
  `requireRole` on the backend actually allows a non-admin session to
  do.
- **`RedirectIfAuthenticated`** wraps `/login` and `/register`. Sends an
  already-signed-in visitor on to `/dashboard` (or a safe `?from=`
  destination) instead of showing them a sign-in form again.
- **`?from=` handling and open-redirect prevention**
  (`app/auth/safeRedirect.ts`'s `resolveSafeRedirect`): `from` is
  attacker-reachable (anyone can link to
  `/login?from=https://evil.example.com`), so it is validated before
  ever being passed to `<Navigate>` — must be a same-origin, absolute
  path (`/...`, never `//...` or an absolute URL to another origin),
  and additionally excluded from being `/login`/`/register` themselves
  (otherwise a crafted `/login?from=/login` would bounce an
  already-authenticated visitor straight back to `/login` forever).
  Falls back to a safe default (`/dashboard`) for anything that doesn't
  pass.
- **Redirect-loop safety is structural, not just the `from` check
  above**: `RequireAuth` only ever redirects _to_ `/login`, and
  `/login`/`/register` are mounted outside `RequireAuth`'s subtree
  entirely (as plain children of `PublicLayout`, gated only by
  `RedirectIfAuthenticated`) — there is no path by which the two guards
  could redirect into each other.

### Role-aware navigation

`shared/config/navigation.ts`'s `getVisibleNavItems`/`isNavItemVisible`
now take `role: Role | undefined` (previously a required `UserRole`) —
`undefined` (the session hasn't resolved yet) is treated the same as
"not permitted" for any item that restricts by role, so a role-gated
nav entry (the `Admin` section) can never flash visible before the real
role is known. The nav config itself, and the "nav visibility is a
display convenience, never a security boundary" framing, are unchanged
from Task 03 — what changed is where the role _comes from_: the real,
backend-confirmed session (`useCurrentUser().data.role`), not a
client-side preview toggle.

### API client and CSRF handling on the frontend

`shared/api/httpClient.ts`'s `apiRequest` is the one function every API
call in this app goes through: `credentials: 'same-origin'` (explicit,
not relied on as a fetch default — this app's whole cookie design
depends on the frontend and API always being same-origin, via the Vite
dev proxy locally and the nginx reverse proxy in Docker/production, see
"Cookie policy" above), an `x-csrf-token` header attached for every
method except `GET`/`HEAD` (matching the backend's `ignoredMethods`
exactly), and every response parsed through a caller-supplied Zod
schema — nothing is trusted structurally just because the HTTP status
looked right.

`shared/api/csrfToken.ts` lazily fetches and caches the CSRF token for
the page's lifetime, rather than re-fetching it around every
login/logout. This is a deliberate finding, not an oversight:
**verified directly against the running API** that a token fetched
anonymously continues to validate for a write request made after
logging in, and that a token fetched again post-login is
byte-for-byte identical to the pre-login one. The reason: `apps/api/src/middleware/csrf.ts`'s
`getSessionIdentifier` falls back from `req.authSessionId` to
`req.csrfScopeId`, but `csrfProtection` is mounted globally in `app.ts`
_before_ any route runs `requireAuth()`/`optionalAuth()` — the only
code that ever populates `req.authSessionId`. That means the
`authSessionId` half of the fallback can never actually be set at
CSRF-validation time for _any_ route, so every token is bound to
`csrfScopeId` alone regardless of login state, contradicting this same
document's earlier "after login, the real session id is used instead"
claim (above, under "CSRF strategy") — which described the intent
behind that fallback, not what it actually does once request ordering
is accounted for. This is **not a CSRF vulnerability**: `csrfScopeId`
is its own genuine, HttpOnly, per-browser secret-bound cookie, so the
double-submit property (an attacker can't read the token or forge the
cookie) holds regardless of which identifier backs it. It does mean the
"rotate the CSRF binding on login" defense-in-depth nicety doesn't
currently engage — out of scope to fix here (Task 05C.1 is
frontend-only; see "Scope restrictions"), noted for whoever next
touches `apps/api/src/middleware/csrf.ts` or `app.ts`'s middleware
order. The frontend's caching strategy was designed around the
_actual_, verified behavior, not the doc comment's original intent —
clearing the cached token on login/logout would cost an extra round
trip for a rotation that doesn't happen.

The cache is still cleared reactively on an actual `INVALID_CSRF_TOKEN`
response (e.g. the underlying cookie expired or was cleared by the
user), so a stale token doesn't fail silently forever — just not
proactively around auth state transitions that, per the above, don't
actually require it.

### Error handling and messaging

`shared/api/ApiError.ts` wraps the backend's existing
`ApiErrorResponseSchema` envelope — no parallel error shape.
`features/auth/authErrors.ts`'s `getAuthErrorMessage` maps error codes
to copy, deliberately generic for `UNAUTHORIZED` ("Invalid email or
password.", never naming which field or whether the account exists) —
matching, not undoing, the backend's own anti-enumeration design for
`POST /login`. `applyServerFieldErrors` maps a `VALIDATION_ERROR`
response's Zod `.flatten()` `fieldErrors` onto React Hook Form field
errors — a defensive fallback for the rare case a submission passes
the form's own `zodResolver` (reusing `RegisterInputSchema`/
`LoginInputSchema` directly from `@academy-library/contracts`, so
client and server validation can't drift) but the server still rejects
it, not the primary validation path.

No global fetch interceptor exists that inspects every response for
`401`/`403` and reacts automatically — deliberately: the task brief
explicitly calls out the redirect-loop and swallowed-error risk such an
interceptor carries. `RequireAuth` reacting to `useCurrentUser()`'s own
state is the only place a `401` currently changes what renders; there
is no other authenticated endpoint yet (Task 05C.2+ territory) for a
`401`/`403` to surface from.

### Known limitations (frontend)

- The CSRF-binding-never-rotates finding above is a real, verified gap
  between this document's original design intent and actual behavior —
  not exploitable, but worth fixing in `apps/api` if/when CSRF binding
  granularity matters more than it does today.
- No account-switching test covers two _different_ real users signing
  in back-to-back in the same browser session beyond the automated
  suite's mocked coverage — real-browser verification for this task
  covered register → login → logout → re-redirect for one account, not
  a second account immediately after.
- `RequireRole` only gates the `/admin` branch; if a future task adds
  more role-specific routes outside it, each needs its own
  `RequireRole` wrapper — there is no single "protect everything by
  default" mechanism, by design (matches the backend's own per-route
  `requireRole` rather than a blanket policy).
