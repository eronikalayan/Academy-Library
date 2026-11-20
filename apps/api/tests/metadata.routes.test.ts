import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CourseRefSchema, GroupRefSchema } from '@academy-library/contracts';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  createCourse,
  createGroup,
  createTestUser,
} from './helpers/resourceFixtures.js';
import { createTestClient, postWithCsrf, type TestClient } from './helpers/testClient.js';

const app = createApp();

const CourseListSchema = z.array(CourseRefSchema);
const GroupListSchema = z.array(GroupRefSchema);

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

// See auth.routes.test.ts's identical `afterAll` for why this resets
// again on the way out, not just on the way in (Task 05D) — this is
// specifically the file whose last test ("...lists every real group...")
// was observed leaving "Zoology Staff"/"Zoology Basics" rows behind.
afterAll(async () => {
  await resetAllTables();
  await prisma.$disconnect();
});

describe('GET /api/v1/courses', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/courses');
    expect(response.status).toBe(401);
  });

  it('403s for a STUDENT', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.get('/api/v1/courses');
    expect(response.status).toBe(403);
  });

  it('200s for a LECTURER and lists every real course, sorted by title', async () => {
    await createCourse('Zoology Basics');
    await createCourse('Algorithms & Data Structures');
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await client.get('/api/v1/courses');
    expect(response.status).toBe(200);
    const courses = CourseListSchema.parse(response.body);
    expect(courses.map((course) => course.title)).toEqual([
      'Algorithms & Data Structures',
      'Zoology Basics',
    ]);
  });

  it('200s for an ADMIN', async () => {
    const admin = await createTestUser('ADMIN');
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await client.get('/api/v1/courses');
    expect(response.status).toBe(200);
  });
});

describe('GET /api/v1/groups', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/groups');
    expect(response.status).toBe(401);
  });

  it('403s for a STUDENT', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.get('/api/v1/groups');
    expect(response.status).toBe(403);
  });

  it('200s for a LECTURER and lists every real group, sorted by name', async () => {
    await createGroup('Zoology Staff');
    await createGroup('Honors Cohort');
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await client.get('/api/v1/groups');
    expect(response.status).toBe(200);
    const groups = GroupListSchema.parse(response.body);
    expect(groups.map((group) => group.name)).toEqual(['Honors Cohort', 'Zoology Staff']);
  });
});
