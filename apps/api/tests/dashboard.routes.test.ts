import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DashboardStatsSchema } from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  createGroup,
  createTestBookCopy,
  createTestCollection,
  createTestLoan,
  createTestResource,
  createTestUser,
} from './helpers/resourceFixtures.js';
import { createTestClient, postWithCsrf, type TestClient } from './helpers/testClient.js';

const app = createApp();

function asStats(body: unknown) {
  return DashboardStatsSchema.parse(body);
}

async function loginAs(client: TestClient, email: string): Promise<void> {
  const response = await postWithCsrf(client, '/api/v1/auth/login', {
    email,
    password: TEST_USER_PASSWORD,
  });
  if (response.status !== 200) {
    throw new Error(`Test setup: login failed for ${email} (${response.status})`);
  }
}

beforeEach(async () => {
  await resetAllTables();
});

afterAll(async () => {
  await resetAllTables();
  await prisma.$disconnect();
});

describe('GET /api/v1/dashboard', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/dashboard');
    expect(response.status).toBe(401);
  });

  it('totalAccessibleResources is authorization-aware: excludes a RESTRICTED resource a STUDENT cannot see, includes it for an ADMIN', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const admin = await createTestUser('ADMIN');
    const group = await createGroup('Not Student’s Group');
    await createTestResource({ title: 'Public One', ownerId: owner.id, visibility: 'PUBLIC' });
    await createTestResource({
      title: 'Hidden One',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const studentClient = createTestClient(app);
    await loginAs(studentClient, student.email);
    const studentStats = asStats((await studentClient.get('/api/v1/dashboard')).body);
    expect(studentStats.totalAccessibleResources).toBe(1);

    const adminClient = createTestClient(app);
    await loginAs(adminClient, admin.email);
    const adminStats = asStats((await adminClient.get('/api/v1/dashboard')).body);
    expect(adminStats.totalAccessibleResources).toBe(2);
  });

  it('savedResourcesCount reflects only this user’s own, still-visible bookmarks', async () => {
    const owner = await createTestUser('LECTURER');
    const studentA = await createTestUser('STUDENT');
    const studentB = await createTestUser('STUDENT');
    const resourceOne = await createTestResource({ title: 'Saved One', ownerId: owner.id });
    const resourceTwo = await createTestResource({ title: 'Saved Two', ownerId: owner.id });

    const clientA = createTestClient(app);
    await loginAs(clientA, studentA.email);
    await postWithCsrf(clientA, '/api/v1/bookmarks', { resourceId: resourceOne.id });
    await postWithCsrf(clientA, '/api/v1/bookmarks', { resourceId: resourceTwo.id });

    const clientB = createTestClient(app);
    await loginAs(clientB, studentB.email);
    await postWithCsrf(clientB, '/api/v1/bookmarks', { resourceId: resourceOne.id });

    const statsA = asStats((await clientA.get('/api/v1/dashboard')).body);
    expect(statsA.savedResourcesCount).toBe(2);

    const statsB = asStats((await clientB.get('/api/v1/dashboard')).body);
    expect(statsB.savedResourcesCount).toBe(1);
  });

  it('availableCollectionsCount reflects visibility', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Not Student’s Group');
    await createTestCollection({
      title: 'Public Collection',
      ownerId: owner.id,
      visibility: 'PUBLIC',
    });
    await createTestCollection({
      title: 'Hidden Collection',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const stats = asStats((await client.get('/api/v1/dashboard')).body);
    expect(stats.availableCollectionsCount).toBe(1);
  });

  it('activeLoansCount counts only this user’s own ACTIVE loans, not RETURNED ones or another user’s', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const otherStudent = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const activeCopy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-ACTIVE',
      status: 'ON_LOAN',
    });
    const returnedCopy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-RETURNED',
    });
    const otherCopy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-OTHER',
      status: 'ON_LOAN',
    });
    await createTestLoan({ copyId: activeCopy.id, userId: student.id, status: 'ACTIVE' });
    await createTestLoan({
      copyId: returnedCopy.id,
      userId: student.id,
      status: 'RETURNED',
      returnedAt: new Date(),
    });
    await createTestLoan({ copyId: otherCopy.id, userId: otherStudent.id, status: 'ACTIVE' });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const stats = asStats((await client.get('/api/v1/dashboard')).body);
    expect(stats.activeLoansCount).toBe(1);
  });

  it('recentResources is bounded and newest-first', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    for (let index = 0; index < 7; index += 1) {
      await createTestResource({ title: `Resource ${index}`, ownerId: owner.id });
    }

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const stats = asStats((await client.get('/api/v1/dashboard')).body);
    expect(stats.recentResources.length).toBeLessThanOrEqual(5);
    expect(stats.recentResources[0]?.title).toBe('Resource 6');
  });
});
