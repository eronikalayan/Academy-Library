import { execFileSync } from 'node:child_process';

/**
 * Resets and reseeds the E2E database to a known baseline before the
 * suite starts — see docs/development.md ("Test database lifecycle")
 * and docs/architecture/decisions.md (Task 05D) for why this exists:
 * without it, E2E runs depended on whatever a previous run (or a test
 * that crashed before its own cleanup ran) happened to leave in the
 * database, which is exactly the kind of order/history-dependent state
 * this task set out to remove.
 *
 * Shells out to the API package rather than talking to Postgres
 * directly from `apps/web` — `pnpm --filter` resolves the workspace
 * root from anywhere inside the monorepo, so this doesn't need to know
 * or compute a path to `apps/api`. Requires `DATABASE_URL` to already
 * be set in the environment this Playwright run is invoked with (the
 * same convention `docs/development.md` already documents for the API
 * server you start manually alongside this suite) — pointed at
 * `academy_library_e2e`, never `academy_library_test` (that database is
 * for `pnpm --filter api test` only — see "Test isolation strategy" —
 * and never the dev database, which `resetAndSeedDatabase.ts`'s own
 * guard refuses outright).
 */
export default function globalSetup(): void {
  execFileSync('pnpm', ['--filter', '@academy-library/api', 'test:e2e:reset-db'], {
    stdio: 'inherit',
    env: process.env,
  });
}
