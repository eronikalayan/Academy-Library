import type { Role } from '@prisma/client';
import type {
  CollectionVisibility,
  ResourceDifficulty,
  ResourceType,
  ResourceVisibility,
} from '@academy-library/contracts';
import { hashPassword } from '../../src/lib/password.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createResource,
  upsertTagsByNames,
} from '../../src/modules/resources/resource.repository.js';
import type { ResourceWithRelations } from '../../src/modules/resources/resource.types.js';

/** Every test user shares this password — never read by anything but
 * `loginAs` below, and only ever written to a dedicated test database
 * (see vitest.config.ts). */
export const TEST_USER_PASSWORD = 'Password123!';

let testUserCounter = 0;

export async function createTestUser(role: Role, displayName = `${role} Test`) {
  testUserCounter += 1;
  const passwordHash = await hashPassword(TEST_USER_PASSWORD);
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${testUserCounter}@example.com`,
      passwordHash,
      displayName,
      role,
      status: 'ACTIVE',
    },
  });
}

export function createGroup(name: string) {
  return prisma.group.create({ data: { name } });
}

export function addUserToGroup(userId: string, groupId: string) {
  return prisma.groupMembership.create({ data: { userId, groupId } });
}

export function createCourse(title: string) {
  return prisma.course.create({ data: { title } });
}

export interface TestResourceInput {
  title: string;
  description?: string;
  type?: ResourceType;
  difficulty?: ResourceDifficulty;
  creatorName?: string;
  ownerId: string;
  visibility?: ResourceVisibility;
  durationSeconds?: number | null;
  tags?: string[];
  courseIds?: string[];
  groupIds?: string[];
}

/** Builds fixtures through the real repository (`createResource`,
 * `upsertTagsByNames`) rather than raw `prisma.resource.create` calls —
 * the same code path a real `POST /resources` request exercises, so a
 * fixture can never drift from what the application actually writes. */
export async function createTestResource(input: TestResourceInput): Promise<ResourceWithRelations> {
  const tagRows = await upsertTagsByNames((input.tags ?? []).map((tag) => tag.toLowerCase()));
  return createResource({
    title: input.title,
    description: input.description ?? 'A test resource used only by this test file.',
    type: input.type ?? 'ARTICLE',
    difficulty: input.difficulty ?? 'BEGINNER',
    creatorName: input.creatorName ?? 'Test Creator',
    visibility: input.visibility ?? 'PUBLIC',
    ownerId: input.ownerId,
    durationSeconds: input.durationSeconds ?? null,
    tagIds: tagRows.map((tag) => tag.id),
    courseIds: input.courseIds ?? [],
    groupIds: input.groupIds ?? [],
  });
}

export interface TestCollectionInput {
  title: string;
  description?: string;
  ownerId: string;
  visibility?: CollectionVisibility;
  groupIds?: string[];
  /** Ordered — array index becomes each item's `position`. */
  resourceIds?: string[];
}

/** Direct `prisma.collection.create` rather than routing through
 * `collection.service.ts` — unlike `createTestResource` (which goes
 * through the real repository because `ResourceWithRelations`'s shape
 * has real conditional logic worth exercising honestly), a collection
 * fixture's only job is to exist with specific items/groups already
 * attached, which `collection.service.ts`'s own create flow doesn't
 * support in one call (items are added via a separate endpoint in the
 * real API). */
export function createTestCollection(input: TestCollectionInput) {
  return prisma.collection.create({
    data: {
      title: input.title,
      description: input.description ?? 'A test collection used only by this test file.',
      visibility: input.visibility ?? 'PUBLIC',
      ownerId: input.ownerId,
      groups: { create: (input.groupIds ?? []).map((groupId) => ({ groupId })) },
      items: {
        create: (input.resourceIds ?? []).map((resourceId, position) => ({
          resourceId,
          position,
        })),
      },
    },
    include: { items: true, groups: true },
  });
}

export interface TestBookCopyInput {
  resourceId: string;
  inventoryCode: string;
  status?: 'AVAILABLE' | 'ON_LOAN' | 'ARCHIVED';
}

/** Direct `prisma.bookCopy.create` rather than routing through
 * `physicalLibrary.service.ts`'s `registerCopy` — a fixture's job here
 * is to exist in a specific state (including `ON_LOAN`/`ARCHIVED`,
 * which the real registration endpoint can never produce directly), not
 * to exercise the real write path the way `createTestResource` does. */
export function createTestBookCopy(input: TestBookCopyInput) {
  return prisma.bookCopy.create({
    data: {
      resourceId: input.resourceId,
      inventoryCode: input.inventoryCode,
      status: input.status ?? 'AVAILABLE',
    },
  });
}

export interface TestLoanInput {
  copyId: string;
  userId: string;
  status?: 'ACTIVE' | 'RETURNED';
  borrowedAt?: Date;
  dueAt?: Date;
  returnedAt?: Date | null;
}

/** Same reasoning as `createTestBookCopy` — lets a test set up a loan
 * already in a specific state (e.g. overdue, or already `RETURNED`)
 * without borrowing-then-manually-advancing-time through the real
 * service. */
export function createTestLoan(input: TestLoanInput) {
  const borrowedAt = input.borrowedAt ?? new Date();
  return prisma.loan.create({
    data: {
      copyId: input.copyId,
      userId: input.userId,
      status: input.status ?? 'ACTIVE',
      borrowedAt,
      dueAt: input.dueAt ?? new Date(borrowedAt.getTime() + 21 * 24 * 60 * 60 * 1000),
      returnedAt: input.returnedAt ?? null,
    },
  });
}
