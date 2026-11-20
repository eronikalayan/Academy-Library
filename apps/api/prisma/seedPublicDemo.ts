/**
 * Production-safe, one-time content initialization for a public
 * deployment — the sibling to `prisma/seed.ts` (the development seed),
 * which explicitly refuses to run with `NODE_ENV=production` because it
 * creates accounts with known, documented passwords and seeds
 * restricted/internal-looking content never meant for public viewing.
 * This script exists so a freshly deployed public demo isn't an empty
 * library, without either of those problems:
 *
 * - **Exactly one account**, with role `ADMIN`, needed only so someone
 *   can actually administer the deployment (manage loans, etc.) — never
 *   a known/documented password. Either a cryptographically random one
 *   is generated and printed to stderr exactly once (never stored
 *   anywhere this script or the database can recall later — write it
 *   down immediately), or, if the operator deliberately set
 *   `DEMO_ADMIN_PASSWORD` themselves before running this, that value is
 *   used and never printed back (they already know it).
 * - **Only PUBLIC-visibility content.** Reuses `prisma/seed.ts`'s own
 *   `COURSE_TITLES`/`RESOURCE_SEEDS`/`COLLECTION_SEEDS` fixtures and
 *   `seedCourse`/`seedResource`/`seedCollection` functions (exported
 *   from that file for exactly this reason — one source of truth for
 *   what the seed content actually is) filtered to `visibility ===
 *   'PUBLIC'` only. No `Group`/`GroupMembership` row is ever created
 *   here, and no RESTRICTED resource or collection is ever seeded —
 *   there is structurally no account for any restricted content to be
 *   restricted *to*. Every PUBLIC fixture's `ownerEmail` (originally
 *   one of the dev seed's three accounts) is redirected to the one
 *   admin account this script creates; `creatorName` (the human-
 *   readable byline shown in the UI, e.g. "M. Kleppmann") is unrelated,
 *   free-text content attribution and is untouched — see
 *   `ResourceSeed`'s doc comment in `seed.ts`.
 * - **Hosts no files.** Exactly like the dev seed, every "BOOK" fixture
 *   is metadata (title/author/publisher/description) plus an optional
 *   external `sourceUrl` — never an uploaded or bundled copyrighted
 *   work. This app has no file-upload/storage system at all.
 *
 * **One-time by design, not merely idempotent.** The admin account's
 * existence (looked up by `DEMO_ADMIN_EMAIL`) is the marker: if it
 * already exists, this script does nothing else at all and returns
 * immediately — it never re-applies the content fixtures on a second
 * run. This matters because `seedResource`/`seedCollection` (shared
 * with the dev seed) *do* overwrite an existing same-titled row's
 * editable fields on every call — fine for a disposable dev database
 * nobody else is editing through the app, not safe to run repeatedly
 * against a public deployment an admin may have since edited through
 * the real UI. Running this script again after the first successful
 * run (e.g. a redeploy that re-triggers a manual init step) is always
 * safe specifically because it becomes a complete no-op the moment the
 * admin account exists — it is never destructive, but it is also never
 * "re-sync the fixtures," on purpose.
 *
 * Never wired into server startup (`src/server.ts`) or the Docker image
 * CMD — run manually, once, after `prisma migrate deploy` against a
 * fresh deployment. See docs/deployment/free-hosting.md.
 *
 * Usage:
 *   DATABASE_URL="<neon-connection-string>" \
 *     pnpm --filter @academy-library/api db:seed:public-demo
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { Course, Group, Resource, User } from '@prisma/client';
import { logger } from '../src/lib/logger.js';
import { hashPassword } from '../src/lib/password.js';
import { normalizeEmail } from '../src/modules/auth/user.repository.js';
import {
  COLLECTION_SEEDS,
  COURSE_TITLES,
  RESOURCE_SEEDS,
  seedCollection,
  seedCourse,
  seedResource,
} from './seed.js';

const prisma = new PrismaClient();

/** Not a secret — an email address is an identifier, not a credential.
 * Override via env if you want a different address; the default is
 * fine to leave as-is precisely because knowing it grants nothing
 * without the (never-defaulted) password. */
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin@academy-library.demo';

/** 18 random bytes, base64url-encoded — 24 characters, far beyond
 * brute-forceable, URL/terminal-safe (no `+`/`/`/`=` to escape or
 * mis-paste). */
function generateRandomPassword(): string {
  return randomBytes(18).toString('base64url');
}

async function main(): Promise<void> {
  const email = normalizeEmail(DEMO_ADMIN_EMAIL);
  const existingAdmin = await prisma.user.findFirst({ where: { email } });

  if (existingAdmin) {
    logger.info(
      `Already initialized — an account for ${email} already exists. Doing nothing else: ` +
        'not touching that account, not re-seeding content. This script is a one-time ' +
        'initializer by design; see its own doc comment for why re-running it is safe ' +
        '(a no-op) rather than merely idempotent.',
    );
    return;
  }

  const explicitPassword = process.env.DEMO_ADMIN_PASSWORD;
  const password = explicitPassword ?? generateRandomPassword();
  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: 'Demo Administrator',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  logger.info(`Created the one demo ADMIN account: ${email}`);

  // Every PUBLIC fixture's `ownerEmail` (one of the dev seed's three
  // accounts) resolves to this one real account instead — see this
  // file's own doc comment for why that's a safe simplification.
  const usersByEmail = new Map<string, User>([
    [normalizeEmail('lecturer@academy.test'), admin],
    [normalizeEmail('admin@academy.test'), admin],
  ]);
  // Never populated — no Group/GroupMembership is ever seeded here, and
  // every fixture used below is filtered to visibility === 'PUBLIC', so
  // nothing ever looks a restrictedToGroupNames entry up in this map.
  const noGroups = new Map<string, Group>();

  const coursesByTitle = new Map<string, Course>();
  for (const title of COURSE_TITLES) {
    coursesByTitle.set(title, await seedCourse(title));
  }

  const publicResourceSeeds = RESOURCE_SEEDS.filter((seed) => seed.visibility === 'PUBLIC');
  const resourcesByTitle = new Map<string, Resource>();
  for (const seed of publicResourceSeeds) {
    resourcesByTitle.set(
      seed.title,
      await seedResource(seed, usersByEmail, noGroups, coursesByTitle),
    );
  }
  logger.info(`Seeded ${publicResourceSeeds.length} public resources`);

  const publicCollectionSeeds = COLLECTION_SEEDS.filter((seed) => seed.visibility === 'PUBLIC');
  for (const seed of publicCollectionSeeds) {
    await seedCollection(seed, usersByEmail, noGroups, resourcesByTitle);
  }
  logger.info(`Seeded ${publicCollectionSeeds.length} public collections`);

  if (explicitPassword === undefined) {
    // The one and only time this password is available anywhere —
    // nothing stores the plaintext, including this script.
    console.error('\n' + '='.repeat(72));
    console.error('DEMO ADMIN ACCOUNT CREATED — SAVE THESE CREDENTIALS NOW');
    console.error("They will not be shown again, and aren't stored anywhere else.");
    console.error('='.repeat(72));
    console.error(`  Email:    ${email}`);
    console.error(`  Password: ${password}`);
    console.error('='.repeat(72) + '\n');
  } else {
    logger.info('Used the DEMO_ADMIN_PASSWORD you provided — not printing it back.');
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Public demo seed failed');
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
