/**
 * Truncates every table `resetAllTables()` knows about, then re-runs the
 * standard development seed (`prisma/seed.ts`) — giving whatever
 * `DATABASE_URL` is set to a deterministic, known-good baseline in one
 * step, without any manual `psql` cleanup. Added for Task 05D so
 * Playwright E2E runs (`apps/web/tests-e2e/`) can start every run from
 * the same 3-account/12-resource baseline rather than inheriting
 * whatever a previous run (or a crashed test that skipped its own
 * cleanup) happened to leave behind.
 *
 * Reuses `resetAllTables()` from the test helpers (see its own doc
 * comment for the `assertDisposableTestDatabase()` guard this inherits —
 * refuses to run against anything that isn't named
 * `academy_library_test`/`academy_library_e2e`) and shells out to the
 * existing, unmodified `db:seed` script rather than importing
 * `prisma/seed.ts`'s internals — `seed.ts` runs its own `main()` at
 * import time, so importing it here would run the seed twice; a
 * subprocess avoids that without needing to restructure a script this
 * task has no other reason to touch.
 *
 * Usage:
 *   DATABASE_URL="postgresql://academy:academy@localhost:5433/academy_library_e2e?schema=public" \
 *     pnpm --filter @academy-library/api test:e2e:reset-db
 */
import { execFileSync } from 'node:child_process';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from '../tests/helpers/db.js';

async function main(): Promise<void> {
  await resetAllTables();
  execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
    stdio: 'inherit',
    env: process.env,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
