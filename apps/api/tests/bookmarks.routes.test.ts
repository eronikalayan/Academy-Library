import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  BookmarkListResponseSchema,
  BookmarkStatusSchema,
} from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  createGroup,
  createTestResource,
  createTestUser,
} from './helpers/resourceFixtures.js';
import {
  createTestClient,
  deleteWithCsrf,
  postWithCsrf,
  type TestClient,
} from './helpers/testClient.js';

const app = createApp();

function asList(body: unknown) {
  return BookmarkListResponseSchema.parse(body);
}
function asStatus(body: unknown) {
  return BookmarkStatusSchema.parse(body);
}
function asApiError(body: unknown) {
  return ApiErrorResponseSchema.parse(body);
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

describe('GET /api/v1/bookmarks', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/bookmarks');
    expect(response.status).toBe(401);
  });

  it('is empty for a user who has saved nothing', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asList((await client.get('/api/v1/bookmarks')).body);
    expect(body.items).toEqual([]);
    expect(body.totalItems).toBe(0);
  });

  it('lists the resources this user saved, newest first', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const first = await createTestResource({ title: 'First Saved', ownerId: owner.id });
    const second = await createTestResource({ title: 'Second Saved', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: first.id });
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: second.id });

    const body = asList((await client.get('/api/v1/bookmarks')).body);
    expect(body.items.map((item) => item.resource.title)).toEqual(['Second Saved', 'First Saved']);
  });

  it('omits a saved resource that has since become inaccessible to this user', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const group = await createGroup('Not Student’s Group');
    const resource = await createTestResource({
      title: 'Will Become Restricted',
      ownerId: owner.id,
      visibility: 'PUBLIC',
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });

    // The resource's visibility changes after it was saved — simulates
    // an owner later restricting something a different user already
    // bookmarked while it was public.
    await prisma.resource.update({
      where: { id: resource.id },
      data: { visibility: 'RESTRICTED' },
    });
    await prisma.resourceGroup.create({ data: { resourceId: resource.id, groupId: group.id } });

    const body = asList((await client.get('/api/v1/bookmarks')).body);
    expect(body.items).toEqual([]);
  });

  it('paginates correctly', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, student.email);

    for (let index = 0; index < 3; index += 1) {
      const resource = await createTestResource({ title: `Saved ${index}`, ownerId: owner.id });
      await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });
    }

    const firstPage = asList((await client.get('/api/v1/bookmarks?page=1&pageSize=2')).body);
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.totalItems).toBe(3);
    expect(firstPage.totalPages).toBe(2);

    const secondPage = asList((await client.get('/api/v1/bookmarks?page=2&pageSize=2')).body);
    expect(secondPage.items).toHaveLength(1);
  });

  it('is accurate for a user with more than 60 saved resources (Task 07 regression)', async () => {
    // The original bug this guards against lived in the frontend's
    // `useIsResourceSaved` (derived from a single capped page), not in
    // this list endpoint's own pagination — but a real database-level
    // listing, not an in-memory one, is exactly what the fixed
    // implementation now promises, so a genuine 60+ fixture proves the
    // new `findVisibleSavedResourcePage` two-query (count, then a page
    // of ids) approach holds up past that boundary, not only in theory.
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, student.email);

    const TOTAL = 65;
    for (let index = 0; index < TOTAL; index += 1) {
      const resource = await createTestResource({
        title: `Bulk Saved ${String(index).padStart(2, '0')}`,
        ownerId: owner.id,
      });
      await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });
    }

    const firstPage = asList((await client.get('/api/v1/bookmarks?page=1&pageSize=60')).body);
    expect(firstPage.items).toHaveLength(60);
    expect(firstPage.totalItems).toBe(TOTAL);
    expect(firstPage.totalPages).toBe(2);

    // Items 61-65 — beyond the frontend's old `SAVED_RESOURCES_PAGE_SIZE`
    // cap — must still be real, correctly paginated rows, not silently
    // dropped or duplicated from page one.
    const secondPage = asList((await client.get('/api/v1/bookmarks?page=2&pageSize=60')).body);
    expect(secondPage.items).toHaveLength(5);
    expect(new Set(secondPage.items.map((item) => item.resource.title)).size).toBe(5);
  });
});

describe('GET /api/v1/bookmarks/:resourceId/status', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/bookmarks/anything/status');
    expect(response.status).toBe(401);
  });

  it('reports isSaved: false for a resource the user has not saved', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Not Saved', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asStatus((await client.get(`/api/v1/bookmarks/${resource.id}/status`)).body);
    expect(body).toEqual({ resourceId: resource.id, isSaved: false });
  });

  it('reports isSaved: true once the resource is saved', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Will Be Saved', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });

    const body = asStatus((await client.get(`/api/v1/bookmarks/${resource.id}/status`)).body);
    expect(body).toEqual({ resourceId: resource.id, isSaved: true });
  });

  it('stays accurate for a resource saved after 60 other bookmarks (Task 07 regression)', async () => {
    // The exact bug this guards against: Task 06's `useIsResourceSaved`
    // derived saved status from a single page of `GET /bookmarks` capped
    // at `pageSize=60`, so a 61st+ saved resource always reported as
    // unsaved on the resource detail page regardless of its true state.
    // This dedicated status endpoint answers the question directly, with
    // no page-size-dependent blind spot.
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, student.email);

    for (let index = 0; index < 60; index += 1) {
      const resource = await createTestResource({
        title: `Filler ${String(index).padStart(2, '0')}`,
        ownerId: owner.id,
      });
      await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });
    }

    const resource61 = await createTestResource({ title: 'The 61st Saved', ownerId: owner.id });
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource61.id });

    const body = asStatus((await client.get(`/api/v1/bookmarks/${resource61.id}/status`)).body);
    expect(body).toEqual({ resourceId: resource61.id, isSaved: true });
  });

  it('never reflects another user’s bookmark on the same resource', async () => {
    const studentA = await createTestUser('STUDENT');
    const studentB = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Only A Saved This', ownerId: owner.id });

    const clientA = createTestClient(app);
    await loginAs(clientA, studentA.email);
    await postWithCsrf(clientA, '/api/v1/bookmarks', { resourceId: resource.id });

    const clientB = createTestClient(app);
    await loginAs(clientB, studentB.email);
    const body = asStatus((await clientB.get(`/api/v1/bookmarks/${resource.id}/status`)).body);
    expect(body.isSaved).toBe(false);
  });
});

describe('POST /api/v1/bookmarks', () => {
  it('401s for an unauthenticated request (with a valid CSRF token, so the auth check — not CSRF — is what is being tested)', async () => {
    const client = createTestClient(app);
    const response = await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: 'anything' });
    expect(response.status).toBe(401);
  });

  it('403s without a CSRF token', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.post('/api/v1/bookmarks').send({ resourceId: 'anything' });
    expect(response.status).toBe(403);
    expect(asApiError(response.body).error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('204s and the resource is then listed', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'To Save', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });
    expect(response.status).toBe(204);

    const body = asList((await client.get('/api/v1/bookmarks')).body);
    expect(body.items.map((item) => item.resource.title)).toEqual(['To Save']);
  });

  it('saving the same resource twice is idempotent — no duplicate', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Save Twice', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });
    const second = await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });
    expect(second.status).toBe(204);

    const body = asList((await client.get('/api/v1/bookmarks')).body);
    expect(body.items).toHaveLength(1);
  });

  it('400s for a nonexistent or inaccessible resourceId', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const group = await createGroup('Not Student’s Group');
    const inaccessible = await createTestResource({
      title: 'Hidden From Student',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);

    const unknown = await postWithCsrf(client, '/api/v1/bookmarks', {
      resourceId: '00000000-0000-0000-0000-000000000000',
    });
    expect(unknown.status).toBe(400);

    const hidden = await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: inaccessible.id });
    expect(hidden.status).toBe(400);
  });
});

describe('DELETE /api/v1/bookmarks/:resourceId', () => {
  it('401s for an unauthenticated request (with a valid CSRF token, so the auth check — not CSRF — is what is being tested)', async () => {
    const client = createTestClient(app);
    const response = await deleteWithCsrf(client, '/api/v1/bookmarks/anything');
    expect(response.status).toBe(401);
  });

  it('204s and removes the bookmark; removing it again is still 204 (idempotent)', async () => {
    const student = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'To Unsave', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    await postWithCsrf(client, '/api/v1/bookmarks', { resourceId: resource.id });

    const first = await deleteWithCsrf(client, `/api/v1/bookmarks/${resource.id}`);
    expect(first.status).toBe(204);
    expect(asList((await client.get('/api/v1/bookmarks')).body).items).toEqual([]);

    const second = await deleteWithCsrf(client, `/api/v1/bookmarks/${resource.id}`);
    expect(second.status).toBe(204);
  });

  it('never affects another user’s bookmark on the same resource', async () => {
    const studentA = await createTestUser('STUDENT');
    const studentB = await createTestUser('STUDENT');
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Shared Resource', ownerId: owner.id });

    const clientA = createTestClient(app);
    await loginAs(clientA, studentA.email);
    await postWithCsrf(clientA, '/api/v1/bookmarks', { resourceId: resource.id });

    const clientB = createTestClient(app);
    await loginAs(clientB, studentB.email);
    // B never saved this resource — deleting it is a no-op for B, and
    // must never touch A's own bookmark row.
    await deleteWithCsrf(clientB, `/api/v1/bookmarks/${resource.id}`);

    const aBody = asList((await clientA.get('/api/v1/bookmarks')).body);
    expect(aBody.items.map((item) => item.resource.title)).toEqual(['Shared Resource']);
  });
});
