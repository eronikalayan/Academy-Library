# Free hosting (Vercel + Render + Neon)

A complete, $0/month deployment of Academy Library: **Vercel** (Hobby
plan) for the static frontend, **Render** (Free Web Service) for the
Express/Prisma API, **Neon** (Free tier) for PostgreSQL. Everything in
this document is driven by files already committed to this repository
(`apps/web/vercel.json`, `render.yaml`, `apps/api/Dockerfile`) — nothing
here requires writing new infrastructure code, only account setup and
environment variables.

This document describes how to deploy, not a claim that it has been
deployed. No step below has been executed against real Vercel/Render/Neon
accounts as part of writing this guide — see the Task 08 completion
report for the precise, per-item breakdown of what was verified locally
versus what remains to be confirmed on real hosting.

**Local Docker Compose support is unaffected** — nothing in this guide
changes `compose.yaml`, `apps/api/Dockerfile`, or `infra/docker/web/`.
Both deployment paths (local Docker, free-tier hosting) read the same
code and the same environment-variable contract.

---

## 1. Create the GitHub repository

This repository is already on GitHub
(`github.com/AndranikDeveloper/Academy-Library`, branch `main`). If
you're deploying a fork or a fresh copy instead:

```bash
git remote add origin https://github.com/<you>/<your-repo>.git
git push -u origin main
```

Both Vercel and Render connect directly to a GitHub repository and
redeploy automatically on every push to the branch you choose (`main`
is assumed throughout this guide) — no separate CI-triggered deploy
step is needed for either.

---

## 2. Create the Neon PostgreSQL database

1. Sign up at [neon.tech](https://neon.tech) (free tier: 1 project, 1
   branch's worth of compute/storage, auto-suspends when idle).
2. Create a project. Note the **pooled** connection string Neon shows
   you (the one whose host contains `-pooler` — e.g.
   `ep-xxx-pooler.region.aws.neon.tech`), not the direct one. The
   pooled endpoint (PgBouncer in transaction mode) is the right choice
   for a short-lived, single-instance Express process like this API.
3. Neon's connection strings already include `?sslmode=require` —
   Prisma's PostgreSQL connector reads `sslmode` directly from the
   connection string with no code-level configuration needed (see
   `apps/api/src/lib/prisma.ts` — it has no SSL-specific options
   because none are needed).
4. Append connection-pool sizing query params, since Render's free
   plan runs exactly one instance and Neon's free tier caps total
   connections. A single Prisma `PrismaClient` defaults to
   `num_physical_cpus * 2 + 1` connections, which is more than this
   app ever needs and more than worth reserving headroom from:

   ```
   postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require&connection_limit=5&pool_timeout=10
   ```

   `connection_limit=5` is comfortably enough for a single free-tier
   instance under light demo traffic; `pool_timeout=10` (seconds) fails
   a request fast rather than hanging if the pool is briefly exhausted.

5. This full string (with the query params from step 4) is what you'll
   paste into Render's `DATABASE_URL` environment variable in step 3
   below. Keep it somewhere safe in the meantime — Neon only shows the
   password once.

**Free-tier limitation:** Neon's free plan auto-suspends the compute
endpoint after a period of inactivity; the first request after a period
of idleness pays a cold-start cost (typically a few hundred ms to a few
seconds) while it resumes. This is normal, not a bug — see
[§14](#14-free-tier-limitations-and-known-trade-offs).

---

## 3. Create the Render Web Service

This repository includes `render.yaml` at the repo root (a [Render
Blueprint](https://render.com/docs/blueprint-spec)) describing the API
service as a Docker web service.

1. In the Render dashboard: **New → Blueprint**, connect your GitHub
   account, select this repository. Render reads `render.yaml`
   automatically and proposes one service: `academy-library-api`.
2. Confirm the plan is **Free**. Click through to create the service —
   Render will attempt a first build/deploy immediately; it will fail
   health checks until the env vars in §6 are filled in (expected —
   `DATABASE_URL` and `CORS_ORIGIN` are deliberately left blank in
   `render.yaml`, marked `sync: false`, since both depend on
   information from other steps in this guide).
3. **Docker build context is the repo root, not `apps/api/`.** This
   matters and is already encoded in `render.yaml`
   (`dockerContext: .`, `dockerfilePath: ./apps/api/Dockerfile`) — the
   API's Dockerfile `COPY`s `pnpm-workspace.yaml`,
   `packages/config`, `packages/contracts`, and `apps/api` from
   root-relative paths to install the pnpm workspace's full dependency
   graph (the API depends on the `@academy-library/contracts` workspace
   package). Pointing the build context at `apps/api/` instead would
   make every one of those paths fail to resolve. If you ever configure
   this service by hand instead of via the Blueprint, get this right.
4. Note the service's public URL once it's live —
   `https://academy-library-api.onrender.com` or similar (Render
   assigns this from the service name; `<service-name>.onrender.com`).
   You'll need it in §5.

This step was verified locally as far as it's possible to without a
real Render account: `docker build -f apps/api/Dockerfile -t
academy-library-api-check .` from the repo root (exactly Render's own
build invocation) succeeds, and the resulting image, run with
`NODE_ENV=production PORT=10000` (Render's documented default/
convention for a Docker web service) and a real `DATABASE_URL`, serves
`GET /api/v1/health` and `GET /api/v1/ready` correctly and issues
`Secure; SameSite=Lax` cookies as expected in production mode. See
[§9](#9-testing-auth) for the exact commands.

---

## 4. The Express API Docker deploy itself

Nothing further is required beyond §3 — `render.yaml` already points
Render at `apps/api/Dockerfile`, which is the same multi-stage,
non-root, production image already used by `compose.yaml` locally (see
[`docs/architecture/decisions.md`](../architecture/decisions.md) and
`infra/docker/README.md`). A few properties worth knowing are already
true of this image and required no changes for Render:

- **Configurable `PORT`/`HOST`**, read via `apps/api/src/config/env.ts`
  and bound in `apps/api/src/server.ts` — Render injects its own `PORT`
  (set explicitly to `10000` in `render.yaml` to match Render's
  documented convention; confirm it matches what Render's dashboard
  shows for this service after the first deploy).
- **`GET /api/v1/health`** (liveness) and **`GET /api/v1/ready`**
  (readiness — checks real database connectivity) already exist
  (`apps/api/src/routes/health.routes.ts`) and are wired up as this
  service's `healthCheckPath` in `render.yaml`.
- **Graceful shutdown** on `SIGTERM`/`SIGINT` (`server.ts`) — Render
  sends `SIGTERM` on redeploy/scale-down; in-flight requests are given
  a chance to finish rather than being dropped mid-response.
- **No reliance on persistent local disk.** All state lives in
  PostgreSQL; nothing is written to the container's filesystem at
  runtime that needs to survive a restart. Render's free tier gives
  every deploy a fresh, ephemeral filesystem — this app never notices.

---

## 5. Configure Vercel (frontend)

This repository includes `apps/web/vercel.json`.

1. In the Vercel dashboard: **Add New → Project**, import this GitHub
   repository.
2. **Root Directory**: set it to `apps/web` in the project's settings.
   Vercel detects this is inside a pnpm workspace (via
   `pnpm-workspace.yaml` at the true repo root) and automatically runs
   `pnpm install` from the real monorepo root so the
   `@academy-library/contracts` workspace dependency resolves
   correctly, then changes into `apps/web` for the build — this is
   Vercel's standard, built-in monorepo behavior; no extra
   configuration is needed for it beyond setting Root Directory
   correctly.
3. Framework preset: **Vite** (should auto-detect). Build command and
   output directory are already pinned explicitly in
   `apps/web/vercel.json` (`pnpm build`, `dist`) rather than left to
   auto-detection, since the build needs to run `tsc` before `vite
build` (see `apps/web/package.json`'s own `build` script).
4. **Before your first real deploy, edit `apps/web/vercel.json`**: the
   `/api/(.*)` rewrite destination is a placeholder —
   `https://REPLACE-WITH-YOUR-RENDER-SERVICE.onrender.com/api/$1`.
   Replace it with the real Render URL from §3, commit, and push (or
   edit directly in the Vercel dashboard's file browser for a
   redeploy, if your plan supports that — otherwise a commit is the
   reliable path). This is the mechanism that makes the browser
   perceive the API as same-origin — see
   [below](#why-the-rewrite-instead-of-a-direct-cross-origin-call) for
   why this is the recommended default over a direct cross-origin call.
5. **Do not set `VITE_API_BASE_URL`** as a Vercel environment variable.
   Leave it unset — the build then uses its default, a relative
   `/api/v1` path (see `apps/web/.env.example`), which is what makes
   the rewrite in step 4 actually take effect. Setting it to the
   Render URL directly would make the frontend call Render
   cross-origin instead, bypassing the rewrite and requiring the
   cross-origin cookie configuration described just below instead.
6. This frontend has **no secrets in its environment at all** — there
   is nothing else to configure here. (If you ever do add a
   `VITE_` variable, remember Vite only exposes variables with that
   exact prefix to client code, and anything exposed this way is
   public — visible in the built JS bundle to anyone.)

### Why the rewrite, instead of a direct cross-origin call?

The Vercel rewrite in step 4 makes the browser see one origin for both
the app and its API calls — exactly mirroring the Vite dev-server proxy
used locally and the nginx reverse proxy used in Docker Compose (see
`docs/architecture/authentication.md`, "Cookie policy"). That means the
existing `SameSite=Lax` cookies and `credentials: 'same-origin'` fetch
calls (`apps/web/src/shared/api/httpClient.ts`) work completely
unchanged — no cookie security downgrade, no extra CORS surface beyond
adding the Vercel domain to `CORS_ORIGIN`.

The alternative — point `VITE_API_BASE_URL` straight at the Render
origin and skip the rewrite — is fully supported (Task 08 added it
deliberately, not as an afterthought) but requires genuinely weakening
the cookie posture to make cross-site cookies work at all:
`COOKIE_SAME_SITE=none` on the API (`apps/api/src/config/env.ts`,
which also forces `Secure` on regardless of `NODE_ENV` when you do
this), paired with `VITE_API_BASE_URL` set to Render's full origin on
the frontend (which automatically switches `httpClient.ts` to
`credentials: 'include'` — see that file's own doc comment for how the
two stay in sync). `CORS_ORIGIN` still needs your real Vercel domain
either way. See `docs/architecture/authentication.md`,
"Cross-origin deployment", for the full reasoning. This guide's
step-by-step instructions assume the rewrite approach throughout,
since it's the recommended default.

---

## 6. Every required environment variable

### Render (API) — `render.yaml` already declares all of these

| Variable               | Required | Where it comes from                           | Notes                                                                                                               |
| ---------------------- | -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`             | yes      | `render.yaml` (`production`)                  | —                                                                                                                   |
| `PORT`                 | yes      | `render.yaml` (`10000`)                       | Must match what Render's dashboard reports for this service                                                         |
| `HOST`                 | yes      | `render.yaml` (`0.0.0.0`)                     | —                                                                                                                   |
| `DATABASE_URL`         | yes      | **you paste this**                            | The Neon pooled connection string from §2, with `connection_limit`/`pool_timeout`                                   |
| `CORS_ORIGIN`          | yes      | **you paste this**                            | Your Vercel domain(s), comma-separated if more than one (e.g. a production + a preview domain)                      |
| `CSRF_SECRET`          | yes      | Render auto-generates (`generateValue: true`) | ≥32 chars, enforced by `src/config/env.ts`                                                                          |
| `SESSION_COOKIE_NAME`  | no       | `render.yaml` (`academy_session`)             | —                                                                                                                   |
| `SESSION_TTL_HOURS`    | no       | `render.yaml` (`720`)                         | 30 days                                                                                                             |
| `REGISTRATION_ENABLED` | no       | `render.yaml` (`false`)                       | Safe-by-default — no email verification/password reset exists yet (`docs/architecture/authentication.md`)           |
| `LOG_LEVEL`            | no       | `render.yaml` (`info`)                        | —                                                                                                                   |
| `COOKIE_SAME_SITE`     | no       | **unset by default**                          | Only needed for the direct cross-origin fallback — see [§5](#why-the-rewrite-instead-of-a-direct-cross-origin-call) |

### Vercel (web) — nothing required

`VITE_API_BASE_URL` is the only variable this app's frontend reads, and
the correct value for the recommended topology is to **leave it
unset** (see §5, step 5). There is no secret, API key, or credential of
any kind that belongs in the frontend's environment.

### One-time init scripts — not service env vars, passed at invocation

| Variable              | Used by               | Notes                                                               |
| --------------------- | --------------------- | ------------------------------------------------------------------- |
| `DEMO_ADMIN_EMAIL`    | `db:seed:public-demo` | Optional — identifier, not a secret                                 |
| `DEMO_ADMIN_PASSWORD` | `db:seed:public-demo` | Optional — unset generates and prints a random one instead (see §8) |

---

## 7. Safe Prisma migrations against Neon

Render's **free** plan has no reliable paid pre-deploy/one-off-job
feature to lean on for running `prisma migrate deploy` automatically on
every deploy. Rather than guess at an unreliable automatic hook, run
migrations as an explicit, manual (or manually-triggered CI) step —
this is also simply safer: a human (or a deliberate `workflow_dispatch`
run) decides when a schema change goes live against the real database,
separately from when new application code goes live.

```bash
# From your own machine, or a GitHub Actions workflow_dispatch job —
# never automatically on every push.
DATABASE_URL="<your Neon connection string, from §2>" \
  pnpm --filter @academy-library/api db:migrate:deploy
```

`prisma migrate deploy` only ever applies pending migrations in order —
it never generates new ones, never resets, never drops data. It is the
same command the local Docker Compose stack's `migrate` service already
runs (`compose.yaml`), applied here by hand instead of as a container
step.

**Immediately after**, verify the hand-written SQL structures Prisma's
own schema can't represent survived the migration — the generated
`searchVector` column, its GIN index, the tag trigram index, the
case-insensitive email uniqueness index, the resource duration CHECK
constraint, and the active-loan partial unique index have all been
accidentally proposed for removal by `prisma migrate dev` locally more
than once across earlier tasks, precisely because nothing in
`schema.prisma` can express them:

```bash
DATABASE_URL="<your Neon connection string>" \
  pnpm --filter @academy-library/api db:check-invariants
```

Exits `0` with every invariant printed `✓` if the database is healthy;
exits `1` and prints exactly which structure(s) are missing otherwise.
This same check already runs in CI (`.github/workflows/ci.yaml`) after
every migration against the CI database — running it again here closes
the gap CI can't cover: the _real_ production/Neon database, which CI
never touches.

Order for a brand-new deployment: create the Render service (§3, it
will fail health checks until the database has at least been migrated)
→ run `db:migrate:deploy` → run `db:check-invariants` → proceed to §8's
content initialization → Render's next health check passes once
`DATABASE_URL` is set and migrations are applied.

---

## 8. Safe demo content initialization

**Never run `pnpm db:seed`** (the development seed,
`apps/api/prisma/seed.ts`) against this deployment — it refuses to run
with `NODE_ENV=production` anyway (a hard-coded guard), because it
creates three accounts with a known, documented, publicly-written-down
password (`DevPassword123!`) and seeds internal-looking restricted
content. That script is for local development only.

Instead, run the production-safe sibling **once**, after migrations:

```bash
DATABASE_URL="<your Neon connection string>" \
  pnpm --filter @academy-library/api db:seed:public-demo
```

This creates exactly one `ADMIN` account (needed only so someone can
actually administer the deployment — e.g. process book-loan returns)
and seeds only `PUBLIC`-visibility courses/resources/collections — no
`Group`, no `GroupMembership`, no `RESTRICTED` content, ever. See
`apps/api/prisma/seedPublicDemo.ts`'s own doc comment for the full
design reasoning.

**The password is never defaulted.** Either:

- Leave `DEMO_ADMIN_PASSWORD` unset — a cryptographically random
  24-character password is generated and printed to the terminal
  **exactly once**, in a clearly marked block. Copy it immediately into
  a password manager; it is never stored anywhere (not in the database,
  not in a file, not recoverable) and is never printed again.
- Or set `DEMO_ADMIN_PASSWORD` yourself beforehand, if you'd rather
  choose it than scrape it from a log.

**This is a true one-time initializer, not merely idempotent.** The
admin account's existence is the marker: run the command again later
(e.g. you re-trigger it by habit after a redeploy) and it does nothing
at all — it explicitly refuses to re-touch the admin account or
re-apply the content fixtures, specifically because an admin may have
since edited that content through the real app, and a second run
re-applying the original seed text would silently discard those edits.

**No file hosting.** Every "BOOK"-type seed fixture is metadata only
(title, author, publisher, description, an optional external source
URL) — this app has no file-upload or file-storage system at all, so
there is no copyrighted book content to accidentally host.

---

## 9. Testing auth

The specific thing to verify after a real deployment is the
browser → Vercel → Render request flow — cookies, CSRF, and CORS all
behaving correctly when the browser only ever talks to the Vercel
domain. Do this in a real browser against your real deployed URLs:

1. Visit your Vercel URL. Open DevTools → Network, confirm requests to
   `/api/v1/...` show as same-origin requests to your own Vercel
   domain (not a separate `onrender.com` origin) — this confirms the
   rewrite in §5 is active.
2. Sign in with the demo admin credentials from §8. Confirm, in
   DevTools → Application → Cookies, that `academy_session`,
   `csrf_secret`, and `csrf_scope` are all present, `HttpOnly`,
   `Secure`, `SameSite=Lax`, scoped to your Vercel domain.
3. Refresh the page — confirm you're still signed in (session
   persists across a reload, not just within the SPA's in-memory
   state).
4. Sign out. Confirm the cookies clear and a direct visit to a
   protected route (e.g. `/dashboard`) redirects to `/login`.
5. Confirm registration is disabled by default: visit `/register`,
   submit the form, and confirm you get a clear "Registration is
   currently disabled on this instance" message (403), not a silent
   failure or a confusing error — this proves `REGISTRATION_ENABLED`
   actually reached the deployed service correctly.

Locally, without a real Vercel/Render account, the closest verification
available is: build the real Docker image exactly as Render will
(`docker build -f apps/api/Dockerfile -t check .` from the repo root),
run it with `NODE_ENV=production PORT=10000` and a real `DATABASE_URL`,
and confirm `Set-Cookie` headers already show `Secure; SameSite=Lax`
and that `POST /auth/login` with real credentials returns `200` with
the expected user — this was done as part of Task 08 and is accurate
for the container Render will actually run, but cannot substitute for
the end-to-end browser check above through the real Vercel rewrite,
which has not been performed (no real Vercel/Render accounts were
created or deployed to as part of this task).

---

## 10. Verifying the complete app

Beyond auth specifically, walk every major flow once against the real
deployed URLs:

- **Library**: browse, search, filter, sort; open a resource's detail
  page (confirm the "At a glance" sidebar, and for a BOOK, its Physical
  Copies section with real availability).
- **Collections**: browse the two public collections the demo seed
  created; open one, confirm its resources list and metadata.
- **Saved resources**: as the demo admin, save a resource, confirm it
  appears on `/saved`, unsave it.
- **Book loans**: borrow a copy of a BOOK-type resource, confirm it
  shows as an active loan on `/loans`; as the (only) admin, mark it
  returned on `/admin/loans`.
- **Dashboard** and **My Learning**: confirm both render real numbers/
  content derived from the seeded data, not placeholders.
- **Responsive/theme**: resize the browser (or use DevTools device
  emulation) through roughly 1440 → 320px, and toggle light/dark —
  confirm no horizontal overflow and that the mobile nav drawer opens
  and closes correctly. (Task 08 already verified this thoroughly via
  Playwright against the local build — see the Task 08 completion
  report — but a spot check against the real deployed frontend is
  still worth doing once, since Vercel's CDN/edge layer is a genuinely
  different serving path than the local `vite preview` server
  Playwright ran against.)

---

## 11. Troubleshooting

- **Render health check never passes.** Almost always means
  `DATABASE_URL` is missing, wrong, or migrations haven't been applied
  yet — check the Render service's logs for the actual Prisma
  connection error. `GET /api/v1/ready` (this service's health check
  path) specifically checks database connectivity, not just that the
  process is up — a `503` there means the process started fine but
  can't reach Postgres.
- **Login works but every subsequent request looks logged-out.** Check
  that `NODE_ENV=production` is actually set on the Render service —
  cookies are `Secure` in production, and `Secure` cookies are silently
  never sent back by the browser over anything but HTTPS. Render
  serves every free-tier service over HTTPS by default, so this is
  almost always a misconfigured `NODE_ENV`, not a real HTTPS problem.
- **`403 Request origin is not allowed`.** `CORS_ORIGIN` on Render
  doesn't include your actual Vercel domain. If you have both a
  production domain and Vercel preview deployments you want to test
  auth against, list all of them, comma-separated.
- **`403 Invalid or missing CSRF token` on every write.** Usually means
  the browser and API ended up perceiving different origins — confirm
  the Vercel rewrite in §5 is actually active (check the Network tab
  per §9, step 1) rather than the frontend accidentally calling Render
  directly (check that `VITE_API_BASE_URL` was never set in Vercel's
  project settings, per §5 step 5).
- **The Vercel build fails on install.** Confirm **Root Directory** is
  set to `apps/web` (§5, step 2) — without it, Vercel doesn't know this
  is a pnpm workspace member and workspace dependency resolution
  (`@academy-library/contracts`) fails.
- **The Render Docker build fails on a `COPY` step.** Almost always
  means the Docker build context got pointed at `apps/api/` instead of
  the repo root — re-check `render.yaml`'s `dockerContext: .` is intact
  if you've hand-edited the service instead of using the Blueprint.

---

## 12. Backups and recovery

Neon's free tier includes **point-in-time restore** within a retention
window (check your plan's current retention period in the Neon
dashboard — this changes with Neon's own pricing/plan terms
independent of this document) — the primary, lowest-effort recovery
path for accidental data loss. Neon's branching feature can also create
a branch from any point in that window to inspect or recover specific
rows without affecting the live branch.

For a manual, portable backup independent of Neon's own retention
window:

```bash
pg_dump "<your Neon connection string>" --format=custom --file=backup.dump
```

To restore into a fresh database (e.g. a new Neon project, or a local
Postgres instance for inspection):

```bash
pg_restore --dbname="<target connection string>" --clean --if-exists backup.dump
```

Take a `pg_dump` backup before any manually-run migration against the
production database, in addition to Neon's own point-in-time restore —
belt and suspenders, and the only option if you ever need to migrate
away from Neon entirely.

---

## 13. Rollback procedure

**Application code** (Vercel + Render): both platforms keep a history
of previous deploys. Vercel: **Deployments** tab → find the last-known-
good deployment → **Promote to Production**. Render: **Deploys** tab on
the service → find the last-known-good deploy → **Redeploy**. Neither
requires touching the database.

**Database migrations**: `prisma migrate deploy` has no built-in
"migrate down" — Prisma's own guidance (and this project's) is that
rollback means either (a) writing and applying a new, forward migration
that undoes the change, or (b) restoring from a backup (§12) if the
migration was destructive and (a) isn't viable (e.g. it already dropped
a column with real data in it). Decide which applies **before** running
a risky migration against production, not after — take a `pg_dump`
backup immediately beforehand regardless.

**If a bad deploy already damaged data** (not just "the new code has a
bug" but "rows were actually lost/corrupted"): stop writes immediately
(roll back the application code first, per above, so nothing keeps
writing against the bad state), then restore via Neon's point-in-time
restore or your own `pg_dump` backup (§12).

---

## 14. Free-tier limitations and known trade-offs

- **Render free web services spin down after a period of inactivity**
  and take tens of seconds to cold-start on the next request. The
  first request after idle time will be slow; this is a Render
  free-tier characteristic, not an application bug. There is no way to
  avoid this without a paid plan (a paid "keep warm" ping from an
  external cron service is a common workaround if this matters to you,
  but is outside this repository's scope to configure).
- **Neon free tier auto-suspends its compute endpoint** similarly —
  the same cold-start consideration applies to the database connection
  itself, compounding with Render's own cold start on a fully idle
  deployment's first request of the day.
- **Single Render instance — no horizontal scaling on the free tier.**
  `apps/api/src/middleware/rateLimit.ts`'s in-memory rate limiter is
  process-local; this is fine on a single free-tier instance but would
  need a shared store (e.g. Redis) before ever running more than one
  replica — see that file's own doc comment.
- **No scheduled jobs on the free tier** (e.g. a periodic
  `DELETE FROM sessions WHERE "expiresAt" < now()` cleanup — see
  `docs/architecture/authentication.md`, "Known limitations"). Expired
  sessions are deleted lazily on the next read that touches them, which
  is correctness-neutral but means genuinely dead rows can accumulate
  slowly over time without ever being proactively swept.
- **No email verification or password reset** (same document,
  same section) — this is why `REGISTRATION_ENABLED` defaults to off
  in production (§6, §8) rather than this app attempting to paper over
  the gap.
- **This guide, the Vercel/Render/Neon configuration files it
  describes, and the auth-topology code changes that make the
  Vercel-rewrite approach safe have all been written and locally
  verified** (Docker build/run, migration + invariant check, cookie
  flags, login flow) **but a real public deployment has not been
  created or verified** as part of writing this document — see the
  Task 08 completion report for the precise, per-item
  verified-locally/ready-but-unverified breakdown.
