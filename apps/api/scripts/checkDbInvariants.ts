/**
 * Verifies that the hand-written SQL structures this schema depends on
 * are actually present on whatever `DATABASE_URL` points at — the
 * generated `searchVector` column, its GIN index, the tag trigram
 * index, the case-insensitive email uniqueness index, the resource
 * duration CHECK constraint, the active-loan partial unique index, and
 * foreign keys. Every one of these has no `schema.prisma` syntax (see
 * each migration's own doc comments) and was added by hand-editing a
 * generated migration — `prisma migrate dev` has repeatedly proposed
 * "fixing" them away as drift across Tasks 05B–07 because Prisma's
 * diff engine can't see them in the schema it generated them from. That
 * mistake is easy to make once, silently, in a real deploy — this is
 * the automated guard against it ever landing unnoticed.
 *
 * Intended to run once after `prisma migrate deploy` in any environment
 * (CI, a fresh Neon database, a local reset) — see
 * docs/deployment/free-hosting.md (the migration steps). Read-only:
 * never modifies the database, so it's always safe to run against a
 * database with real data in it, including production.
 *
 * Usage:
 *   pnpm --filter @academy-library/api db:check-invariants
 */
import { prisma } from '../src/lib/prisma.js';

interface InvariantResult {
  name: string;
  ok: boolean;
  detail: string;
}

/** Every check below is read-only `pg_catalog` introspection via a
 * hardcoded (never user-supplied) identifier — `$queryRawUnsafe` is
 * safe here for that reason; the whole point is verifying structures
 * Prisma's own schema/query builder has no representation for in the
 * first place. A query against a name that doesn't exist at all (e.g.
 * `'x'::regclass` for a dropped index) throws in Postgres; that's
 * treated as "missing," not a script crash, so one failed invariant
 * never hides the rest. */
async function queryOne<T>(sql: string): Promise<T | undefined> {
  try {
    const rows = await prisma.$queryRawUnsafe<T[]>(sql);
    return rows[0];
  } catch {
    return undefined;
  }
}

async function checkSearchVectorColumn(): Promise<InvariantResult> {
  const name = 'resources.searchVector — GENERATED ALWAYS STORED tsvector column';
  const row = await queryOne<{ attgenerated: string; type: string }>(`
    SELECT attgenerated, atttypid::regtype::text AS type
    FROM pg_attribute
    WHERE attrelid = 'resources'::regclass AND attname = 'searchVector' AND NOT attisdropped
  `);
  if (!row) return { name, ok: false, detail: 'column not found' };
  const ok = row.attgenerated === 's' && row.type === 'tsvector';
  return {
    name,
    ok,
    detail: ok
      ? 'present, STORED, tsvector'
      : `found but wrong shape (attgenerated=${row.attgenerated}, type=${row.type})`,
  };
}

async function checkGinIndex(indexName: string, onWhat: string): Promise<InvariantResult> {
  const name = `${indexName} — GIN index on ${onWhat}`;
  const row = await queryOne<{ amname: string }>(`
    SELECT am.amname
    FROM pg_index idx
    JOIN pg_class ic ON ic.oid = idx.indexrelid
    JOIN pg_am am ON am.oid = ic.relam
    WHERE ic.oid = '${indexName}'::regclass
  `);
  if (!row) return { name, ok: false, detail: 'index not found' };
  const ok = row.amname === 'gin';
  return { name, ok, detail: ok ? 'present, GIN' : `present but using ${row.amname}, not GIN` };
}

async function checkUniqueIndex(indexName: string): Promise<InvariantResult> {
  const name = `${indexName} — unique index`;
  const row = await queryOne<{ indisunique: boolean }>(`
    SELECT indisunique FROM pg_index WHERE indexrelid = '${indexName}'::regclass
  `);
  if (!row) return { name, ok: false, detail: 'index not found' };
  return {
    name,
    ok: row.indisunique,
    detail: row.indisunique ? 'present, unique' : 'present but not unique',
  };
}

async function checkCheckConstraint(constraintName: string): Promise<InvariantResult> {
  const name = `${constraintName} — CHECK constraint`;
  const row = await queryOne<{ contype: string }>(`
    SELECT contype FROM pg_constraint WHERE conname = '${constraintName}'
  `);
  if (!row) return { name, ok: false, detail: 'constraint not found' };
  const ok = row.contype === 'c';
  return { name, ok, detail: ok ? 'present, CHECK' : `present but contype=${row.contype}` };
}

async function checkPartialUniqueIndex(
  indexName: string,
  expectedPredicateFragment: string,
): Promise<InvariantResult> {
  const name = `${indexName} — partial unique index (predicate includes "${expectedPredicateFragment}")`;
  const row = await queryOne<{ indisunique: boolean; pred: string | null }>(`
    SELECT indisunique, pg_get_expr(indpred, indrelid) AS pred
    FROM pg_index WHERE indexrelid = '${indexName}'::regclass
  `);
  if (!row) return { name, ok: false, detail: 'index not found' };
  const ok = row.indisunique && !!row.pred && row.pred.includes(expectedPredicateFragment);
  return {
    name,
    ok,
    detail: ok
      ? `present, unique, filtered on: ${row.pred}`
      : `found but not a matching partial unique index (unique=${row.indisunique}, predicate=${row.pred ?? 'none'})`,
  };
}

async function checkPgTrgmExtension(): Promise<InvariantResult> {
  const name = 'pg_trgm extension';
  const row = await queryOne<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
  );
  return {
    name,
    ok: row !== undefined,
    detail: row ? 'enabled' : 'not installed — the tag trigram index cannot function',
  };
}

/** A precise lower bound, not an approximation — 20 foreign keys exist
 * as of Task 08 (verified against a freshly migrated database). Using
 * `>=` rather than `===` means a future migration that adds more FKs
 * doesn't need this threshold bumped to stay green, while a migration
 * that accidentally drops one still fails the check. */
const MINIMUM_EXPECTED_FOREIGN_KEYS = 20;

async function checkForeignKeyCount(): Promise<InvariantResult> {
  const name = `at least ${MINIMUM_EXPECTED_FOREIGN_KEYS} foreign key constraints (public schema)`;
  const row = await queryOne<{ count: bigint }>(`
    SELECT count(*)::bigint AS count
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  `);
  const count = Number(row?.count ?? 0);
  const ok = count >= MINIMUM_EXPECTED_FOREIGN_KEYS;
  return { name, ok, detail: `found ${count}` };
}

async function main(): Promise<void> {
  const results: InvariantResult[] = [
    await checkPgTrgmExtension(),
    await checkUniqueIndex('users_email_lower_key'),
    await checkSearchVectorColumn(),
    await checkGinIndex('resources_search_vector_idx', 'resources.searchVector'),
    await checkGinIndex('tags_name_trgm_idx', 'tags.name (trigram)'),
    await checkCheckConstraint('resources_duration_matches_type_check'),
    await checkPartialUniqueIndex('loans_active_copy_unique', 'ACTIVE'),
    await checkForeignKeyCount(),
  ];

  const failures = results.filter((result) => !result.ok);

  for (const result of results) {
    console.error(`${result.ok ? '✓' : '✗'} ${result.name}\n    ${result.detail}`);
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} of ${results.length} database invariant(s) failed. This database is missing structure this application's correctness depends on (data integrity, search, or concurrency guarantees) — see each migration's own doc comments in apps/api/prisma/migrations/ for how to restore it. Refusing to report success.`,
    );
    process.exitCode = 1;
    return;
  }

  console.error(`\nAll ${results.length} database invariants hold.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
