import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { LearningPageResponseSchema } from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  createCourse,
  createGroup,
  createTestCollection,
  createTestResource,
  createTestUser,
} from './helpers/resourceFixtures.js';
import { createTestClient, postWithCsrf, type TestClient } from './helpers/testClient.js';

const app = createApp();

function asLearningPage(body: unknown) {
  return LearningPageResponseSchema.parse(body);
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

describe('GET /api/v1/learning', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/learning');
    expect(response.status).toBe(401);
  });

  it('courseGroups includes a course with a visible resource, excludes a course with none', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const populatedCourse = await createCourse('Populated Course');
    await createCourse('Empty Course');
    await createTestResource({
      title: 'Course Resource',
      ownerId: owner.id,
      courseIds: [populatedCourse.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asLearningPage((await client.get('/api/v1/learning')).body);

    const titles = body.courseGroups.map((group) => group.course.title);
    expect(titles).toContain('Populated Course');
    expect(titles).not.toContain('Empty Course');
  });

  it('courseGroups never includes a RESTRICTED resource the viewer cannot see', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Not Student’s Group');
    const course = await createCourse('Guarded Course');
    await createTestResource({
      title: 'Hidden Course Resource',
      ownerId: owner.id,
      courseIds: [course.id],
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asLearningPage((await client.get('/api/v1/learning')).body);
    expect(body.courseGroups.map((g) => g.course.title)).not.toContain('Guarded Course');
  });

  it('relevantCollections respects visibility', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Not Student’s Group');
    await createTestCollection({
      title: 'Open Collection',
      ownerId: owner.id,
      visibility: 'PUBLIC',
    });
    await createTestCollection({
      title: 'Closed Collection',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asLearningPage((await client.get('/api/v1/learning')).body);
    const titles = body.relevantCollections.map((c) => c.title);
    expect(titles).toContain('Open Collection');
    expect(titles).not.toContain('Closed Collection');
  });

  it('recentMaterials is newest-first', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    await createTestResource({ title: 'Older', ownerId: owner.id });
    await createTestResource({ title: 'Newer', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asLearningPage((await client.get('/api/v1/learning')).body);
    expect(body.recentMaterials[0]?.title).toBe('Newer');
  });

  it('recommendations are empty when the viewer has saved nothing', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asLearningPage((await client.get('/api/v1/learning')).body);
    expect(body.recommendations).toEqual([]);
  });

  it('recommends a resource sharing a course with a saved resource, with a transparent reason, excluding the saved one itself', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const course = await createCourse('Shared Course');
    const saved = await createTestResource({
      title: 'Saved Resource',
      ownerId: owner.id,
      courseIds: [course.id],
    });
    await createTestResource({
      title: 'Related Resource',
      ownerId: owner.id,
      courseIds: [course.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: saved.id });

    const body = asLearningPage((await client.get('/api/v1/learning')).body);
    const recommendedTitles = body.recommendations.map((r) => r.resource.title);
    expect(recommendedTitles).toContain('Related Resource');
    expect(recommendedTitles).not.toContain('Saved Resource');
    const match = body.recommendations.find((r) => r.resource.title === 'Related Resource');
    expect(match?.reason).toContain('Shared Course');
  });

  it('never recommends a resource the viewer cannot see, even if it shares a tag', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Not Student’s Group');
    const saved = await createTestResource({
      title: 'Saved Tagged Resource',
      ownerId: owner.id,
      tags: ['shared-tag'],
    });
    await createTestResource({
      title: 'Hidden Tagged Resource',
      ownerId: owner.id,
      tags: ['shared-tag'],
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: saved.id });

    const body = asLearningPage((await client.get('/api/v1/learning')).body);
    expect(body.recommendations.map((r) => r.resource.title)).not.toContain(
      'Hidden Tagged Resource',
    );
  });
});
