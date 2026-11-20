import { prisma } from '../../src/lib/prisma.js';

/**
 * Explicit, code-level guard against ever running a destructive reset
 * against a real database — defense in depth alongside
 * `vitest.config.ts`'s hardcoded `DATABASE_URL` (which already pins
 * every `pnpm --filter api test` run to `academy_library_test`): that
 * config-level pin protects the normal test run, but every function in
 * this file is also plain, importable TypeScript, reusable by anything
 * else that links against it (see `scripts/resetAndSeedDatabase.ts`,
 * used to give Playwright E2E its own disposable database — Task 05D).
 * A future caller in a different context (a different env setup, a
 * script invoked with the wrong `DATABASE_URL` exported) would have no
 * other safety net, so the check lives here, at the one place every
 * caller already goes through, rather than trusted to be re-derived
 * correctly by each new caller.
 */
function assertDisposableTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  const looksDisposable = /\/academy_library_(test|e2e)(\?|$)/.test(url);
  if (process.env.NODE_ENV === 'production' || !looksDisposable) {
    throw new Error(
      'Refusing to reset tables: DATABASE_URL does not look like a disposable ' +
        `test/e2e database (got: ${url || '<unset>'}). This guard exists specifically ` +
        'to prevent resetAllTables()/resetAuthTables()/resetResourceTables() from ever ' +
        'running against a real (dev/production) database.',
    );
  }
}

/** Wipes every row this test suite could have written. Deletes sessions
 * before users (the FK is `onDelete: Cascade`, so order doesn't matter
 * for correctness, but this avoids relying on that for clarity). Run
 * before each test, not just the whole suite, so tests never depend on
 * execution order or leak state into one another. */
export async function resetAuthTables(): Promise<void> {
  assertDisposableTestDatabase();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

/** Resources, collections, and loans must all be wiped before users:
 * `Resource.ownerId`/`Collection.ownerId`/`Loan.userId` are all
 * `onDelete: Restrict` foreign keys (see schema.prisma — deliberately
 * not cascading, since none of them should silently disappear just
 * because the referenced account does), so a user row cannot be deleted
 * while any of them still reference it. `loan.deleteMany()` runs first
 * of all: a `Loan` also references `BookCopy` (`onDelete: Restrict`
 * there too — loan history must survive even an archived copy), so
 * loans must be gone before `bookCopy.deleteMany()`, which itself must
 * run before `resource.deleteMany()` (`BookCopy.resourceId` is
 * `Restrict`, same "preserve loan history" reasoning — see that model's
 * doc comment in schema.prisma). `collection.deleteMany()` runs next —
 * a collection's own items reference resources (`onDelete: Cascade`),
 * so deleting collections before resources avoids relying on that
 * cascade firing in a particular order, same "explicit over implicit"
 * reasoning as this function already applied to session/user ordering.
 * Deleting a resource or collection itself cascades its own join-table
 * rows (`resource_tags`/`resource_courses`/`resource_groups`/
 * `collection_resources`/`collection_groups`/`saved_resources`)
 * automatically. */
export async function resetResourceTables(): Promise<void> {
  assertDisposableTestDatabase();
  await prisma.loan.deleteMany();
  await prisma.bookCopy.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.course.deleteMany();
  await prisma.tag.deleteMany();
}

export async function resetAllTables(): Promise<void> {
  await resetResourceTables();
  await resetAuthTables();
}
