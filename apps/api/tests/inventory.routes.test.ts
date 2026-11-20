import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  BookCopyListResponseSchema,
  BookCopySchema,
} from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  createGroup,
  createTestBookCopy,
  createTestResource,
  createTestUser,
} from './helpers/resourceFixtures.js';
import {
  createTestClient,
  patchWithCsrf,
  postWithCsrf,
  type TestClient,
} from './helpers/testClient.js';

const app = createApp();

function asList(body: unknown) {
  return BookCopyListResponseSchema.parse(body);
}
function asCopy(body: unknown) {
  return BookCopySchema.parse(body);
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

describe('GET /api/v1/resources/:resourceId/copies', () => {
  it('200s with an empty list for a BOOK resource with no copies, anonymously (PUBLIC)', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({
      title: 'Bare Book',
      ownerId: owner.id,
      type: 'BOOK',
    });

    const client = createTestClient(app);
    const body = asList((await client.get(`/api/v1/resources/${resource.id}/copies`)).body);
    expect(body.items).toEqual([]);
  });

  it('lists every copy regardless of status, anonymously, for a PUBLIC resource', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({
      title: 'Stocked Book',
      ownerId: owner.id,
      type: 'BOOK',
    });
    await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-A',
      status: 'AVAILABLE',
    });
    await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-B',
      status: 'ON_LOAN',
    });
    await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-C',
      status: 'ARCHIVED',
    });

    const client = createTestClient(app);
    const body = asList((await client.get(`/api/v1/resources/${resource.id}/copies`)).body);
    expect(body.items.map((item) => item.inventoryCode).sort()).toEqual([
      'INV-A',
      'INV-B',
      'INV-C',
    ]);
    expect(body.items.map((item) => item.status).sort()).toEqual([
      'ARCHIVED',
      'AVAILABLE',
      'ON_LOAN',
    ]);
  });

  it('404s for a nonexistent resource', async () => {
    const client = createTestClient(app);
    const response = await client.get(
      '/api/v1/resources/00000000-0000-0000-0000-000000000000/copies',
    );
    expect(response.status).toBe(404);
  });

  it('404s for a RESTRICTED resource the caller cannot see, never confirming it exists', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Not Student’s Group');
    const resource = await createTestResource({
      title: 'Restricted Book',
      ownerId: owner.id,
      type: 'BOOK',
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-HIDDEN' });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.get(`/api/v1/resources/${resource.id}/copies`);
    expect(response.status).toBe(404);
  });

  it('200s for a RESTRICTED resource a group member can see', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Honors');
    await prisma.groupMembership.create({ data: { userId: student.id, groupId: group.id } });
    const resource = await createTestResource({
      title: 'Restricted Book Visible',
      ownerId: owner.id,
      type: 'BOOK',
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-VISIBLE' });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asList((await client.get(`/api/v1/resources/${resource.id}/copies`)).body);
    expect(body.items).toHaveLength(1);
  });
});

describe('POST /api/v1/resources/:resourceId/copies', () => {
  it('401s for an unauthenticated request (with a valid CSRF token, so the auth check — not CSRF — is what is being tested)', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const client = createTestClient(app);
    const response = await postWithCsrf(client, `/api/v1/resources/${resource.id}/copies`, {
      inventoryCode: 'X',
    });
    expect(response.status).toBe(401);
  });

  it('403s for a STUDENT', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, `/api/v1/resources/${resource.id}/copies`, {
      inventoryCode: 'X',
    });
    expect(response.status).toBe(403);
  });

  it('403s for a LECTURER — inventory management is ADMIN-only, not LECTURER+ADMIN', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await postWithCsrf(client, `/api/v1/resources/${resource.id}/copies`, {
      inventoryCode: 'X',
    });
    expect(response.status).toBe(403);
  });

  it('403s without a CSRF token', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await client
      .post(`/api/v1/resources/${resource.id}/copies`)
      .send({ inventoryCode: 'X' });
    expect(response.status).toBe(403);
    expect(asApiError(response.body).error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('400s for a non-BOOK resource', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({
      title: 'An Article',
      ownerId: admin.id,
      type: 'ARTICLE',
    });
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await postWithCsrf(client, `/api/v1/resources/${resource.id}/copies`, {
      inventoryCode: 'X',
    });
    expect(response.status).toBe(400);
  });

  it('201s and registers an AVAILABLE copy', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await postWithCsrf(client, `/api/v1/resources/${resource.id}/copies`, {
      inventoryCode: 'INV-NEW-1',
    });
    expect(response.status).toBe(201);
    const copy = asCopy(response.body);
    expect(copy).toMatchObject({
      inventoryCode: 'INV-NEW-1',
      status: 'AVAILABLE',
      resourceId: resource.id,
    });
  });

  it('409s for a duplicate inventory code, even across two different resources', async () => {
    const admin = await createTestUser('ADMIN');
    const resourceA = await createTestResource({
      title: 'Book A',
      ownerId: admin.id,
      type: 'BOOK',
    });
    const resourceB = await createTestResource({
      title: 'Book B',
      ownerId: admin.id,
      type: 'BOOK',
    });
    const client = createTestClient(app);
    await loginAs(client, admin.email);

    const first = await postWithCsrf(client, `/api/v1/resources/${resourceA.id}/copies`, {
      inventoryCode: 'DUPLICATE-CODE',
    });
    expect(first.status).toBe(201);

    const second = await postWithCsrf(client, `/api/v1/resources/${resourceB.id}/copies`, {
      inventoryCode: 'DUPLICATE-CODE',
    });
    expect(second.status).toBe(409);
  });
});

describe('PATCH /api/v1/resources/:resourceId/copies/:copyId', () => {
  it('401s for an unauthenticated request (with a valid CSRF token, so the auth check — not CSRF — is what is being tested)', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });
    const client = createTestClient(app);
    const response = await patchWithCsrf(
      client,
      `/api/v1/resources/${resource.id}/copies/${copy.id}`,
      { status: 'ARCHIVED' },
    );
    expect(response.status).toBe(401);
  });

  it('403s for a non-ADMIN', async () => {
    const admin = await createTestUser('ADMIN');
    const lecturer = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await patchWithCsrf(
      client,
      `/api/v1/resources/${resource.id}/copies/${copy.id}`,
      { status: 'ARCHIVED' },
    );
    expect(response.status).toBe(403);
  });

  it('400s for any status other than ARCHIVED — the contract rejects it outright', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await patchWithCsrf(
      client,
      `/api/v1/resources/${resource.id}/copies/${copy.id}`,
      { status: 'AVAILABLE' },
    );
    expect(response.status).toBe(400);
  });

  it('404s when the copy does not belong to the given resource', async () => {
    const admin = await createTestUser('ADMIN');
    const resourceA = await createTestResource({
      title: 'Book A',
      ownerId: admin.id,
      type: 'BOOK',
    });
    const resourceB = await createTestResource({
      title: 'Book B',
      ownerId: admin.id,
      type: 'BOOK',
    });
    const copyOfA = await createTestBookCopy({ resourceId: resourceA.id, inventoryCode: 'INV-A' });
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await patchWithCsrf(
      client,
      `/api/v1/resources/${resourceB.id}/copies/${copyOfA.id}`,
      { status: 'ARCHIVED' },
    );
    expect(response.status).toBe(404);
  });

  it('200s and archives an AVAILABLE copy; archiving it again is idempotent', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });
    const client = createTestClient(app);
    await loginAs(client, admin.email);

    const first = await patchWithCsrf(
      client,
      `/api/v1/resources/${resource.id}/copies/${copy.id}`,
      { status: 'ARCHIVED' },
    );
    expect(first.status).toBe(200);
    expect(asCopy(first.body).status).toBe('ARCHIVED');

    const second = await patchWithCsrf(
      client,
      `/api/v1/resources/${resource.id}/copies/${copy.id}`,
      { status: 'ARCHIVED' },
    );
    expect(second.status).toBe(200);
    expect(asCopy(second.body).status).toBe('ARCHIVED');
  });

  it('409s archiving a copy that is currently ON_LOAN', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-1',
      status: 'ON_LOAN',
    });
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await patchWithCsrf(
      client,
      `/api/v1/resources/${resource.id}/copies/${copy.id}`,
      { status: 'ARCHIVED' },
    );
    expect(response.status).toBe(409);
  });
});
