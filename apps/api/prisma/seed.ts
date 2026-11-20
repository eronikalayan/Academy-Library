/**
 * Deterministic, idempotent development seed — creates one account per
 * role, a small group/membership/course/tag foundation, and a varied set
 * of resources exercising every resource type, both visibilities, and
 * both owning roles, so local development and manual testing never
 * start from an empty database. Safe to run repeatedly: every entity is
 * looked up by its natural key first and updated in place rather than
 * duplicated — see each `seed*` function below for its specific lookup
 * key, since not everything has (or should have) a DB-level unique
 * constraint to upsert against.
 *
 * Deliberately NOT reachable from any API endpoint — this is the only
 * place in the codebase that creates a `LECTURER`/`ADMIN` account or a
 * `Group`/`GroupMembership` row (there is no Group CRUD API in this
 * task), which is exactly the point: non-student accounts and group
 * membership only come from this script or direct database
 * administration, never from an HTTP request.
 *
 * See docs/architecture/authentication.md ("Development accounts") for
 * account password overrides and docs/domain/resources.md ("Development
 * seed") for the resource/group fixtures below.
 *
 * This script refuses to run with `NODE_ENV=production` (see `main`
 * below) — it creates accounts with known, documented passwords and
 * restricted/internal-looking content never meant for a public
 * deployment. `prisma/seedPublicDemo.ts` is the production-safe sibling:
 * it reuses this file's PUBLIC-only course/resource/collection fixtures
 * (exported above for exactly that reason) but creates no account with
 * a known password and seeds nothing restricted — see that file's own
 * doc comment and docs/deployment/free-hosting.md.
 */
import { PrismaClient } from '@prisma/client';
import type {
  BookCopy,
  BookCopyStatus,
  CollectionVisibility,
  Course,
  Group,
  LoanStatus,
  Resource,
  ResourceDifficulty,
  ResourceType,
  ResourceVisibility,
  Role,
  User,
} from '@prisma/client';
import { logger } from '../src/lib/logger.js';
import { hashPassword } from '../src/lib/password.js';
import { normalizeEmail } from '../src/modules/auth/user.repository.js';
import {
  createResource,
  updateResource,
  upsertTagsByNames,
} from '../src/modules/resources/resource.repository.js';

const prisma = new PrismaClient();

const DEFAULT_DEV_PASSWORD = 'DevPassword123!';

interface SeedAccount {
  email: string;
  displayName: string;
  role: Role;
  /** Env var a developer can set to override `DEFAULT_DEV_PASSWORD` for
   * this one account — never a real secret, just a way to avoid every
   * local checkout sharing the literal same password byte-for-byte. */
  passwordEnvVar: string;
}

const SEED_ACCOUNTS: readonly SeedAccount[] = [
  {
    email: 'student@academy.test',
    displayName: 'Sam Student',
    role: 'STUDENT',
    passwordEnvVar: 'SEED_STUDENT_PASSWORD',
  },
  {
    email: 'lecturer@academy.test',
    displayName: 'Lee Lecturer',
    role: 'LECTURER',
    passwordEnvVar: 'SEED_LECTURER_PASSWORD',
  },
  {
    email: 'admin@academy.test',
    displayName: 'Alex Admin',
    role: 'ADMIN',
    passwordEnvVar: 'SEED_ADMIN_PASSWORD',
  },
];

async function seedAccount(account: SeedAccount): Promise<User> {
  const email = normalizeEmail(account.email);
  const password = process.env[account.passwordEnvVar] ?? DEFAULT_DEV_PASSWORD;
  const passwordHash = await hashPassword(password);

  // Not `prisma.user.upsert` — `email` isn't a Prisma-declared unique
  // field (see the case-insensitive-uniqueness note in schema.prisma),
  // so Prisma Client has no `where: { email }` to upsert against. A
  // plain find-then-write is fine here; a seed script has no concurrent
  // writers to race against.
  const existing = await prisma.user.findFirst({ where: { email } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          displayName: account.displayName,
          role: account.role,
          status: 'ACTIVE',
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: account.displayName,
          role: account.role,
          status: 'ACTIVE',
        },
      });

  logger.info(`Seeded ${account.role} account: ${email}`);
  return user;
}

// ---------------------------------------------------------------------
// Groups and memberships
// ---------------------------------------------------------------------

/** `Group.name` is a real, Prisma-declared unique field (unlike
 * `User.email`), so this can be a genuine `upsert`. */
async function seedGroup(name: string): Promise<Group> {
  const group = await prisma.group.upsert({ where: { name }, create: { name }, update: {} });
  logger.info(`Seeded group: ${name}`);
  return group;
}

const GROUP_MEMBERSHIPS: readonly { email: string; groupName: string }[] = [
  { email: 'lecturer@academy.test', groupName: 'CS Department Staff' },
  { email: 'admin@academy.test', groupName: 'CS Department Staff' },
  { email: 'admin@academy.test', groupName: 'Honors Cohort' },
  { email: 'student@academy.test', groupName: 'Honors Cohort' },
];

async function seedMembership(userId: string, groupId: string): Promise<void> {
  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId, groupId } },
    create: { userId, groupId },
    update: {},
  });
}

// ---------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------

export const COURSE_TITLES: readonly string[] = [
  'Introduction to Computer Science',
  'Algorithms & Data Structures',
  'Databases at Scale',
  'Machine Learning Foundations',
  'Software Architecture',
];

/** `Course.title` is also a real unique field — same reasoning as
 * `seedGroup`. */
export async function seedCourse(title: string): Promise<Course> {
  const course = await prisma.course.upsert({ where: { title }, create: { title }, update: {} });
  logger.info(`Seeded course: ${title}`);
  return course;
}

// ---------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------

export interface ResourceSeed {
  title: string;
  description: string;
  type: ResourceType;
  difficulty: ResourceDifficulty;
  creatorName: string;
  creatorAffiliation?: string;
  sourceUrl?: string;
  publisher?: string;
  /** ISO date string — kept as a plain string here and parsed to `Date`
   * at the call site, same as every other date-ish seed fixture. */
  publishedAt?: string;
  durationSeconds?: number;
  visibility: ResourceVisibility;
  restrictedToGroupNames?: string[];
  courseTitles: string[];
  tags: string[];
  ownerEmail: string;
}

/**
 * Covers all six resource types, all three difficulties, both
 * visibilities (including one resource restricted to two groups at
 * once), and both roles that can own a resource — enough variety for
 * manual testing and for the integration tests to have real fixtures to
 * assert against (see tests/resources.routes.test.ts).
 */
export const RESOURCE_SEEDS: readonly ResourceSeed[] = [
  {
    title: 'Introduction to Algorithms',
    description:
      'The standard reference on algorithms and data structures, covering sorting, graph algorithms, and algorithmic analysis from first principles.',
    type: 'BOOK',
    difficulty: 'BEGINNER',
    creatorName: 'R. Kesari',
    publisher: 'MIT Press',
    publishedAt: '2009-07-31T00:00:00.000Z',
    visibility: 'PUBLIC',
    courseTitles: ['Algorithms & Data Structures', 'Introduction to Computer Science'],
    tags: ['algorithms', 'data-structures'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Designing Data-Intensive Applications',
    description:
      'A deep look at the principles behind reliable, scalable data systems — replication, partitioning, transactions, and consistency.',
    type: 'BOOK',
    difficulty: 'ADVANCED',
    creatorName: 'M. Kleppmann',
    publisher: "O'Reilly Media",
    publishedAt: '2017-03-16T00:00:00.000Z',
    visibility: 'PUBLIC',
    courseTitles: ['Databases at Scale', 'Software Architecture'],
    tags: ['databases', 'systems-design'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'A Gentle Introduction to Gradient Descent',
    description:
      'Builds up gradient descent from a single-variable cost function to the multivariate case used to train real models.',
    type: 'ARTICLE',
    difficulty: 'INTERMEDIATE',
    creatorName: 'J. Alammar',
    sourceUrl: 'https://example.edu/articles/gradient-descent',
    visibility: 'PUBLIC',
    courseTitles: ['Machine Learning Foundations'],
    tags: ['machine-learning', 'statistics'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Big-O Notation Explained',
    description:
      'A visual, example-driven walkthrough of algorithmic complexity and why it matters before you write a line of code.',
    type: 'VIDEO',
    difficulty: 'BEGINNER',
    creatorName: 'Lee Lecturer',
    durationSeconds: 720,
    visibility: 'PUBLIC',
    courseTitles: ['Algorithms & Data Structures'],
    tags: ['algorithms'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Binary Search Practice Set',
    description:
      'Ten hand-picked binary search variants, from the textbook case to off-by-one traps on rotated and duplicate-heavy arrays.',
    type: 'EXERCISE',
    difficulty: 'BEGINNER',
    creatorName: 'Lee Lecturer',
    visibility: 'PUBLIC',
    courseTitles: ['Algorithms & Data Structures'],
    tags: ['algorithms', 'data-structures'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Guest Lecture: Scaling Postgres at 10M QPS',
    description:
      'A recorded guest lecture on connection pooling, read replicas, and partitioning strategies at real production scale.',
    type: 'RECORDING',
    difficulty: 'ADVANCED',
    creatorName: 'Alex Admin',
    durationSeconds: 2700,
    publishedAt: '2024-11-02T00:00:00.000Z',
    visibility: 'PUBLIC',
    courseTitles: ['Databases at Scale'],
    tags: ['databases', 'systems-design'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Dataset: Housing Prices (Cleaned)',
    description:
      'A cleaned, de-duplicated housing-price dataset prepared for regression exercises — no missing values, consistent units.',
    type: 'OTHER',
    difficulty: 'INTERMEDIATE',
    creatorName: 'Alex Admin',
    visibility: 'PUBLIC',
    courseTitles: ['Machine Learning Foundations'],
    tags: ['machine-learning'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Advanced Systems Design Reading List',
    description:
      'A curated reading order through distributed systems classics, meant to follow Databases at Scale, not replace it.',
    type: 'BOOK',
    difficulty: 'ADVANCED',
    creatorName: 'Lee Lecturer',
    visibility: 'PUBLIC',
    courseTitles: ['Software Architecture', 'Databases at Scale'],
    tags: ['systems-design'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Career Conversations: From Bootcamp to Backend',
    description:
      'A relaxed, recorded panel conversation with three former students now working as backend engineers.',
    type: 'RECORDING',
    difficulty: 'BEGINNER',
    creatorName: 'Lee Lecturer',
    durationSeconds: 1800,
    visibility: 'PUBLIC',
    courseTitles: [],
    tags: ['career'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Faculty Hiring Committee Notes',
    description:
      'Internal notes from the department hiring committee — not for general circulation.',
    type: 'OTHER',
    difficulty: 'ADVANCED',
    creatorName: 'Lee Lecturer',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['CS Department Staff'],
    courseTitles: [],
    tags: ['career'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Honors Thesis Proposal Template',
    description:
      'The required proposal template and rubric for students in the honors thesis track.',
    type: 'ARTICLE',
    difficulty: 'INTERMEDIATE',
    creatorName: 'Alex Admin',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['Honors Cohort'],
    courseTitles: [],
    tags: ['career'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Weekly Algorithms Study Group (Restricted)',
    description:
      'Problem sets for the joint honors/staff weekly study group — restricted to its two participant groups.',
    type: 'EXERCISE',
    difficulty: 'INTERMEDIATE',
    creatorName: 'Lee Lecturer',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['Honors Cohort', 'CS Department Staff'],
    courseTitles: ['Algorithms & Data Structures'],
    tags: ['algorithms'],
    ownerEmail: 'lecturer@academy.test',
  },
];

export async function seedResource(
  seed: ResourceSeed,
  usersByEmail: ReadonlyMap<string, User>,
  groupsByName: ReadonlyMap<string, Group>,
  coursesByTitle: ReadonlyMap<string, Course>,
): Promise<Resource> {
  const owner = usersByEmail.get(normalizeEmail(seed.ownerEmail));
  if (!owner)
    throw new Error(`Seed resource "${seed.title}" references unknown owner ${seed.ownerEmail}`);

  const courseIds = seed.courseTitles.map((title) => {
    const course = coursesByTitle.get(title);
    if (!course)
      throw new Error(`Seed resource "${seed.title}" references unknown course ${title}`);
    return course.id;
  });
  const groupIds = (seed.restrictedToGroupNames ?? []).map((name) => {
    const group = groupsByName.get(name);
    if (!group) throw new Error(`Seed resource "${seed.title}" references unknown group ${name}`);
    return group.id;
  });
  const tagRows = await upsertTagsByNames(seed.tags.map((tag) => tag.trim().toLowerCase()));
  const tagIds = tagRows.map((tag) => tag.id);

  const sharedFields = {
    title: seed.title,
    description: seed.description,
    type: seed.type,
    difficulty: seed.difficulty,
    creatorName: seed.creatorName,
    creatorAffiliation: seed.creatorAffiliation ?? null,
    coverImageUrl: null,
    sourceUrl: seed.sourceUrl ?? null,
    publishedAt: seed.publishedAt ? new Date(seed.publishedAt) : null,
    publisher: seed.publisher ?? null,
    durationSeconds: seed.durationSeconds ?? null,
    visibility: seed.visibility,
    tagIds,
    courseIds,
    groupIds,
  };

  // Resources have no natural unique key to `upsert` against (titles are
  // not DB-unique, deliberately — see the `Resource` model's doc comment
  // in schema.prisma) — a plain find-by-title-then-write is fine here,
  // same reasoning as `seedAccount`'s email lookup. `updateResource`
  // never takes an `ownerId` (see resource.repository.ts — there is no
  // ownership-change path at all, by design), so re-seeding an existing
  // resource cannot change who owns it; the fixtures above are written
  // to keep each title's owner stable across edits for exactly that
  // reason.
  const existing = await prisma.resource.findFirst({ where: { title: seed.title } });
  const resource = existing
    ? await updateResource(existing.id, sharedFields)
    : await createResource({ ...sharedFields, ownerId: owner.id });
  logger.info(`Seeded resource: ${seed.title}`);
  return resource;
}

// ---------------------------------------------------------------------
// Collections (Task 06)
// ---------------------------------------------------------------------

export interface CollectionSeed {
  title: string;
  description: string;
  visibility: CollectionVisibility;
  restrictedToGroupNames?: string[];
  ownerEmail: string;
  /** Ordered — position in this array becomes each item's `position`. */
  resourceTitles: string[];
}

/**
 * Four named collections (per the task brief's own examples), split
 * across both visibilities, both owning roles, and both seeded groups
 * — exactly the variety `collections.routes.test.ts` needs real
 * fixtures to assert visibility/ownership rules against. "Python
 * Backend Fundamentals" and "Frontend Engineering Essentials" don't
 * have literally-matching resources in `RESOURCE_SEEDS` (no seeded
 * resource mentions Python, and nothing here is frontend-specific) —
 * their titles are taken directly from the brief; the bundled
 * resources are the closest thematic fit from what already exists,
 * not a claim that the content is topically exact.
 */
export const COLLECTION_SEEDS: readonly CollectionSeed[] = [
  {
    title: 'Python Backend Fundamentals',
    description:
      'A starting-point bundle for anyone moving into backend work — systems-design reading paired with a real operational war story.',
    visibility: 'PUBLIC',
    ownerEmail: 'admin@academy.test',
    resourceTitles: [
      'Career Conversations: From Bootcamp to Backend',
      'Designing Data-Intensive Applications',
      'Guest Lecture: Scaling Postgres at 10M QPS',
    ],
  },
  {
    title: 'Algorithms Study Materials',
    description:
      'The recommended order for building algorithmic intuition: watch, then read, then practice.',
    visibility: 'PUBLIC',
    ownerEmail: 'lecturer@academy.test',
    resourceTitles: [
      'Big-O Notation Explained',
      'Introduction to Algorithms',
      'Binary Search Practice Set',
    ],
  },
  {
    title: 'Frontend Engineering Essentials',
    description:
      'Honors-track supplementary materials — not for general circulation, hence the group restriction.',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['Honors Cohort'],
    ownerEmail: 'admin@academy.test',
    resourceTitles: [
      'Honors Thesis Proposal Template',
      'A Gentle Introduction to Gradient Descent',
    ],
  },
  {
    title: 'Advanced Database Concepts',
    description:
      'Staff-only bundle: the department reading list plus internal hiring-committee context, restricted to department staff.',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['CS Department Staff'],
    ownerEmail: 'lecturer@academy.test',
    resourceTitles: ['Designing Data-Intensive Applications', 'Faculty Hiring Committee Notes'],
  },
];

/**
 * Collections have no natural unique key either (same reasoning as
 * `seedResource`) — find-by-title-then-write. Item membership/order is
 * replaced wholesale on every re-seed (delete then recreate with
 * fresh `position`s) rather than diffed, since this only ever runs
 * against the small, fixed `resourceTitles` list above, not a user-
 * facing mutation path — the atomicity/concurrency care in
 * `collection.repository.ts`'s real reorder logic has no bearing on a
 * script with no concurrent writers.
 */
export async function seedCollection(
  seed: CollectionSeed,
  usersByEmail: ReadonlyMap<string, User>,
  groupsByName: ReadonlyMap<string, Group>,
  resourcesByTitle: ReadonlyMap<string, Resource>,
): Promise<void> {
  const owner = usersByEmail.get(normalizeEmail(seed.ownerEmail));
  if (!owner) {
    throw new Error(`Seed collection "${seed.title}" references unknown owner ${seed.ownerEmail}`);
  }
  const groupIds = (seed.restrictedToGroupNames ?? []).map((name) => {
    const group = groupsByName.get(name);
    if (!group) {
      throw new Error(`Seed collection "${seed.title}" references unknown group ${name}`);
    }
    return group.id;
  });
  const resourceIds = seed.resourceTitles.map((title) => {
    const resource = resourcesByTitle.get(title);
    if (!resource) {
      throw new Error(`Seed collection "${seed.title}" references unknown resource ${title}`);
    }
    return resource.id;
  });

  const existing = await prisma.collection.findFirst({ where: { title: seed.title } });

  await prisma.$transaction(async (tx) => {
    const collection = existing
      ? await tx.collection.update({
          where: { id: existing.id },
          data: { description: seed.description, visibility: seed.visibility },
        })
      : await tx.collection.create({
          data: {
            title: seed.title,
            description: seed.description,
            visibility: seed.visibility,
            ownerId: owner.id,
          },
        });

    await tx.collectionGroup.deleteMany({ where: { collectionId: collection.id } });
    if (groupIds.length > 0) {
      await tx.collectionGroup.createMany({
        data: groupIds.map((groupId) => ({ collectionId: collection.id, groupId })),
      });
    }

    await tx.collectionResource.deleteMany({ where: { collectionId: collection.id } });
    await tx.collectionResource.createMany({
      data: resourceIds.map((resourceId, position) => ({
        collectionId: collection.id,
        resourceId,
        position,
      })),
    });
  });

  logger.info(`Seeded collection: ${seed.title}`);
}

// ---------------------------------------------------------------------
// Bookmarks (Task 06)
// ---------------------------------------------------------------------

const BOOKMARK_SEEDS: readonly { userEmail: string; resourceTitle: string }[] = [
  { userEmail: 'student@academy.test', resourceTitle: 'Introduction to Algorithms' },
  { userEmail: 'student@academy.test', resourceTitle: 'Big-O Notation Explained' },
  { userEmail: 'lecturer@academy.test', resourceTitle: 'Designing Data-Intensive Applications' },
];

async function seedBookmark(
  seed: { userEmail: string; resourceTitle: string },
  usersByEmail: ReadonlyMap<string, User>,
  resourcesByTitle: ReadonlyMap<string, Resource>,
): Promise<void> {
  const user = usersByEmail.get(normalizeEmail(seed.userEmail));
  const resource = resourcesByTitle.get(seed.resourceTitle);
  if (!user || !resource) {
    throw new Error(
      `Seed bookmark references unknown user ${seed.userEmail} or resource ${seed.resourceTitle}`,
    );
  }
  await prisma.savedResource.upsert({
    where: { userId_resourceId: { userId: user.id, resourceId: resource.id } },
    create: { userId: user.id, resourceId: resource.id },
    update: {},
  });
}

// ---------------------------------------------------------------------
// Physical Library (Task 07)
// ---------------------------------------------------------------------

interface BookCopySeed {
  resourceTitle: string;
  inventoryCode: string;
  status?: BookCopyStatus;
}

/** Three of the `BOOK`-type resources above get physical copies — not
 * every resource, since only `BOOK` resources can have any (see
 * `physicalLibrary.service.ts`'s `requireBookType`). One copy is left
 * `ARCHIVED` (a retired/damaged copy whose loan history still needs
 * somewhere to live) specifically so the seed demonstrates that state
 * exists, not just AVAILABLE/ON_LOAN. */
const BOOK_COPY_SEEDS: readonly BookCopySeed[] = [
  { resourceTitle: 'Introduction to Algorithms', inventoryCode: 'INV-ALG-001' },
  { resourceTitle: 'Introduction to Algorithms', inventoryCode: 'INV-ALG-002' },
  { resourceTitle: 'Introduction to Algorithms', inventoryCode: 'INV-ALG-003' },
  { resourceTitle: 'Designing Data-Intensive Applications', inventoryCode: 'INV-DDIA-001' },
  {
    resourceTitle: 'Designing Data-Intensive Applications',
    inventoryCode: 'INV-DDIA-002',
    status: 'ARCHIVED',
  },
  { resourceTitle: 'Advanced Systems Design Reading List', inventoryCode: 'INV-ASDRL-001' },
];

/** `inventoryCode` is a real, Prisma-declared unique field — a genuine
 * `upsert`, same reasoning as `seedGroup`/`seedCourse`. */
async function seedBookCopy(
  seed: BookCopySeed,
  resourcesByTitle: ReadonlyMap<string, Resource>,
): Promise<BookCopy> {
  const resource = resourcesByTitle.get(seed.resourceTitle);
  if (!resource) {
    throw new Error(`Seed book copy references unknown resource ${seed.resourceTitle}`);
  }
  const copy = await prisma.bookCopy.upsert({
    where: { inventoryCode: seed.inventoryCode },
    create: {
      resourceId: resource.id,
      inventoryCode: seed.inventoryCode,
      status: seed.status ?? 'AVAILABLE',
    },
    // Reapplies this copy's base status on every re-run too — safe
    // because `seedLoan` below runs *after* every `seedBookCopy` call
    // and unconditionally sets `ON_LOAN`/`AVAILABLE` for whichever
    // copies `LOAN_SEEDS` references, so its pass is always the last,
    // authoritative write for a loan-involved copy regardless of what
    // this upsert just set.
    update: { resourceId: resource.id, status: seed.status ?? 'AVAILABLE' },
  });
  logger.info(`Seeded book copy: ${seed.inventoryCode} (${seed.resourceTitle})`);
  return copy;
}

interface LoanSeed {
  copyInventoryCode: string;
  userEmail: string;
  status: LoanStatus;
  /** Days relative to "now" this seed runs — kept relative (not a fixed
   * ISO date) so a loan seeded as "overdue" or "due soon" stays overdue
   * or due soon no matter when `prisma db seed` actually runs. */
  borrowedDaysAgo: number;
  dueDaysFromNow: number;
  returned?: boolean;
}

/**
 * Three loans covering every state the UI needs real fixtures for: an
 * active loan safely within its period, an overdue active loan (to show
 * `isOverdue` live), and a returned loan (loan history). Each also
 * flips its copy's `status` to match — `ON_LOAN` for the two active
 * loans, left `AVAILABLE` for the returned one — since a loan and its
 * copy's status must never disagree with each other, the same invariant
 * `localPhysicalLibraryProvider.ts`'s real borrow/return transactions
 * maintain.
 */
const LOAN_SEEDS: readonly LoanSeed[] = [
  {
    copyInventoryCode: 'INV-ALG-002',
    userEmail: 'student@academy.test',
    status: 'ACTIVE',
    borrowedDaysAgo: 3,
    dueDaysFromNow: 18,
  },
  {
    copyInventoryCode: 'INV-ASDRL-001',
    userEmail: 'admin@academy.test',
    status: 'ACTIVE',
    borrowedDaysAgo: 26,
    dueDaysFromNow: -5,
  },
  {
    copyInventoryCode: 'INV-DDIA-001',
    userEmail: 'lecturer@academy.test',
    status: 'RETURNED',
    borrowedDaysAgo: 40,
    dueDaysFromNow: -19,
    returned: true,
  },
];

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** No natural unique key for a `Loan` at the schema level — identified
 * here, for this seed script only, by its (copy, user) pair, which is
 * unique across `LOAN_SEEDS` by construction. Re-seeding updates the
 * existing row's dates in place rather than creating a second loan for
 * the same pair. */
async function seedLoan(
  seed: LoanSeed,
  usersByEmail: ReadonlyMap<string, User>,
  copiesByInventoryCode: ReadonlyMap<string, BookCopy>,
): Promise<void> {
  const user = usersByEmail.get(normalizeEmail(seed.userEmail));
  const copy = copiesByInventoryCode.get(seed.copyInventoryCode);
  if (!user || !copy) {
    throw new Error(
      `Seed loan references unknown user ${seed.userEmail} or copy ${seed.copyInventoryCode}`,
    );
  }

  const borrowedAt = daysFromNow(-seed.borrowedDaysAgo);
  const dueAt = daysFromNow(seed.dueDaysFromNow);
  const returnedAt = seed.returned ? daysFromNow(seed.dueDaysFromNow - 2) : null;

  const existing = await prisma.loan.findFirst({ where: { copyId: copy.id, userId: user.id } });
  if (existing) {
    await prisma.loan.update({
      where: { id: existing.id },
      data: { status: seed.status, borrowedAt, dueAt, returnedAt },
    });
  } else {
    await prisma.loan.create({
      data: {
        copyId: copy.id,
        userId: user.id,
        status: seed.status,
        borrowedAt,
        dueAt,
        returnedAt,
      },
    });
  }

  await prisma.bookCopy.update({
    where: { id: copy.id },
    data: { status: seed.status === 'ACTIVE' ? 'ON_LOAN' : 'AVAILABLE' },
  });
  logger.info(`Seeded loan: ${seed.copyInventoryCode} -> ${seed.userEmail} (${seed.status})`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    logger.error(
      'Refusing to run the development seed with NODE_ENV=production. ' +
        'This creates accounts with known, documented passwords — never acceptable outside development/test.',
    );
    process.exitCode = 1;
    return;
  }

  const usersByEmail = new Map<string, User>();
  for (const account of SEED_ACCOUNTS) {
    usersByEmail.set(normalizeEmail(account.email), await seedAccount(account));
  }

  const groupNames = [...new Set(GROUP_MEMBERSHIPS.map((membership) => membership.groupName))];
  const groupsByName = new Map<string, Group>();
  for (const name of groupNames) {
    groupsByName.set(name, await seedGroup(name));
  }
  for (const membership of GROUP_MEMBERSHIPS) {
    const user = usersByEmail.get(normalizeEmail(membership.email));
    const group = groupsByName.get(membership.groupName);
    if (!user || !group) continue;
    await seedMembership(user.id, group.id);
  }
  logger.info(`Seeded ${GROUP_MEMBERSHIPS.length} group memberships`);

  const coursesByTitle = new Map<string, Course>();
  for (const title of COURSE_TITLES) {
    coursesByTitle.set(title, await seedCourse(title));
  }

  const resourcesByTitle = new Map<string, Resource>();
  for (const seed of RESOURCE_SEEDS) {
    resourcesByTitle.set(
      seed.title,
      await seedResource(seed, usersByEmail, groupsByName, coursesByTitle),
    );
  }

  for (const seed of COLLECTION_SEEDS) {
    await seedCollection(seed, usersByEmail, groupsByName, resourcesByTitle);
  }

  for (const seed of BOOKMARK_SEEDS) {
    await seedBookmark(seed, usersByEmail, resourcesByTitle);
  }
  logger.info(`Seeded ${BOOKMARK_SEEDS.length} bookmarks`);

  const copiesByInventoryCode = new Map<string, BookCopy>();
  for (const seed of BOOK_COPY_SEEDS) {
    copiesByInventoryCode.set(seed.inventoryCode, await seedBookCopy(seed, resourcesByTitle));
  }

  for (const seed of LOAN_SEEDS) {
    await seedLoan(seed, usersByEmail, copiesByInventoryCode);
  }
  logger.info(`Seeded ${LOAN_SEEDS.length} loans`);
}

// Guarded so importing this module's exports (COURSE_TITLES,
// RESOURCE_SEEDS, seedResource, etc. — see prisma/seedPublicDemo.ts)
// never also runs this file's own `main()`. ES modules execute their
// top-level code on import, same as any other module; without this
// guard, `seedPublicDemo.ts` importing from here would silently trigger
// *this* file's `NODE_ENV=production` refusal (and its own
// `process.exitCode = 1`) as a side effect of the import alone —
// exactly the pitfall `scripts/resetAndSeedDatabase.ts`'s own doc
// comment already flags for this same import-vs-side-effect hazard,
// which is why that script shells out instead of importing. Runs only
// when this file is executed directly (`tsx prisma/seed.ts` / `pnpm
// db:seed`), not when it's merely imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Seed failed');
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
