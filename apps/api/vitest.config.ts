import { defineConfig } from 'vitest/config';

/**
 * Integration tests (see tests/auth.routes.test.ts) run against a real
 * PostgreSQL database — not a mock — per
 * docs/architecture/authentication.md ("Testing strategy"): session
 * expiry/revocation and the case-insensitive email unique index are
 * exactly the kind of behavior a mocked Prisma client can't exercise
 * honestly. `academy_library_test` is a separate database from the dev
 * one (`academy_library`) on the same local Postgres instance/port, so
 * tests never touch dev data — see docs/development.md ("Running the
 * test suite") for how to create it locally. CI provisions the same
 * database/port via a Postgres service container
 * (.github/workflows/ci.yaml) so this one config works in both places
 * without branching on environment.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Every file below that touches the database resets its own tables
    // in `beforeEach` (see tests/helpers/db.ts) — correct for tests
    // *within* one file, which Vitest always runs sequentially, but not
    // safe *across* files, which Vitest otherwise runs concurrently in
    // separate workers against this same real, shared test database.
    // Added by Task 05B, when a second DB-touching file
    // (resources.routes.test.ts) first made that cross-file race
    // possible — tests/auth.routes.test.ts alone never triggered it,
    // since nothing else was resetting the same tables out from under
    // it. Forcing one file at a time trades some wall-clock time for
    // integration tests that cannot flake on worker scheduling.
    fileParallelism: false,
    env: {
      DATABASE_URL:
        'postgresql://academy:academy@localhost:5433/academy_library_test?schema=public',
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
      // A fixed, obviously-fake value — this is a non-production,
      // throwaway test database; never reuse a real CSRF_SECRET here.
      CSRF_SECRET: 'test-csrf-secret-do-not-use-in-production-00000000',
    },
  },
});
