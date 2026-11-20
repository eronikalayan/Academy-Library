import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  CollectionDetailSchema,
  CollectionSummaryListResponseSchema,
} from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  addUserToGroup,
  createGroup,
  createTestCollection,
  createTestResource,
  createTestUser,
} from './helpers/resourceFixtures.js';
import {
  createTestClient,
  deleteWithCsrf,
  patchWithCsrf,
  postWithCsrf,
  type TestClient,
} from './helpers/testClient.js';

const app = createApp();

function asList(body: unknown) {
  return CollectionSummaryListResponseSchema.parse(body);
}
function asDetail(body: unknown) {
  return CollectionDetailSchema.parse(body);
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

// See resources.routes.test.ts's identical `afterAll` — resets again on
// the way out, not just the way in (Task 05D), so whichever file Vitest
// runs last never leaves rows behind in the shared test database.
afterAll(async () => {
  await resetAllTables();
  await prisma.$disconnect();
});

describe('GET /api/v1/collections', () => {
  it('401s for an unauthenticated request — unlike Resources, Collections require auth even for PUBLIC', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/collections');
    expect(response.status).toBe(401);
  });

  it('a signed-in STUDENT sees a PUBLIC collection but not a RESTRICTED one they are not a member of', async () => {
    const lecturer = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const otherGroup = await createGroup('Other Group');
    await createTestCollection({ title: 'Public One', ownerId: lecturer.id, visibility: 'PUBLIC' });
    await createTestCollection({
      title: 'Restricted One',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [otherGroup.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.get('/api/v1/collections');
    expect(response.status).toBe(200);
    const body = asList(response.body);
    expect(body.items.map((item) => item.title)).toEqual(['Public One']);
  });

  it('a STUDENT who is a member of the restricted group sees that collection too', async () => {
    const lecturer = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const group = await createGroup('Cohort A');
    await addUserToGroup(student.id, group.id);
    await createTestCollection({
      title: 'Cohort Materials',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.get('/api/v1/collections');
    const body = asList(response.body);
    expect(body.items.map((item) => item.title)).toEqual(['Cohort Materials']);
  });

  it('an ADMIN sees every collection, including other owners’ RESTRICTED ones', async () => {
    const lecturer = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const group = await createGroup('Some Group');
    await createTestCollection({ title: 'Public One', ownerId: lecturer.id });
    await createTestCollection({
      title: 'Restricted One',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await client.get('/api/v1/collections');
    const body = asList(response.body);
    expect(body.items.map((item) => item.title).sort()).toEqual(['Public One', 'Restricted One']);
  });

  it('filters by title search', async () => {
    const lecturer = await createTestUser('LECTURER');
    await createTestCollection({ title: 'Algorithms Path', ownerId: lecturer.id });
    await createTestCollection({ title: 'Databases Path', ownerId: lecturer.id });

    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await client.get('/api/v1/collections?search=Algorithms');
    const body = asList(response.body);
    expect(body.items.map((item) => item.title)).toEqual(['Algorithms Path']);
  });

  it('paginates correctly and reports an accurate totalItems/totalPages', async () => {
    const lecturer = await createTestUser('LECTURER');
    for (let index = 0; index < 5; index += 1) {
      await createTestCollection({ title: `Collection ${index}`, ownerId: lecturer.id });
    }

    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const firstPage = asList((await client.get('/api/v1/collections?page=1&pageSize=2')).body);
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.totalItems).toBe(5);
    expect(firstPage.totalPages).toBe(3);

    const lastPage = asList((await client.get('/api/v1/collections?page=3&pageSize=2')).body);
    expect(lastPage.items).toHaveLength(1);
  });

  it("a collection's resourceCount reflects only what THIS viewer can see, never the raw membership size", async () => {
    const lecturer = await createTestUser('LECTURER');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Members Only');
    const publicResource = await createTestResource({ title: 'Public Res', ownerId: lecturer.id });
    const restrictedResource = await createTestResource({
      title: 'Restricted Res',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });
    await createTestCollection({
      title: 'Mixed Bundle',
      ownerId: lecturer.id,
      resourceIds: [publicResource.id, restrictedResource.id],
    });

    const client = createTestClient(app);
    await loginAs(client, outsider.email);
    const body = asList((await client.get('/api/v1/collections')).body);
    expect(body.items[0]?.resourceCount).toBe(1);
  });
});

describe('GET /api/v1/collections/:id', () => {
  it('404s for an unknown id', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await client.get('/api/v1/collections/00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
    expect(asApiError(response.body).error.code).toBe('NOT_FOUND');
  });

  it('404s (not 403) for a RESTRICTED collection the caller cannot see', async () => {
    const lecturer = await createTestUser('LECTURER');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Not Mine');
    const collection = await createTestCollection({
      title: 'Hidden',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, outsider.email);
    const response = await client.get(`/api/v1/collections/${collection.id}`);
    expect(response.status).toBe(404);
  });

  it('omits a resource item restricted away from this viewer, while including the public ones', async () => {
    const lecturer = await createTestUser('LECTURER');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Members Only');
    const publicResource = await createTestResource({ title: 'Public Res', ownerId: lecturer.id });
    const restrictedResource = await createTestResource({
      title: 'Restricted Res',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });
    const collection = await createTestCollection({
      title: 'Mixed Bundle',
      ownerId: lecturer.id,
      resourceIds: [publicResource.id, restrictedResource.id],
    });

    const client = createTestClient(app);
    await loginAs(client, outsider.email);
    const detail = asDetail((await client.get(`/api/v1/collections/${collection.id}`)).body);
    expect(detail.resources.map((item) => item.resource.title)).toEqual(['Public Res']);
  });

  it('a group member sees the restricted item too, and capabilities are false for a non-owner', async () => {
    const lecturer = await createTestUser('LECTURER');
    const member = await createTestUser('STUDENT');
    const group = await createGroup('Members Only');
    await addUserToGroup(member.id, group.id);
    const restrictedResource = await createTestResource({
      title: 'Restricted Res',
      ownerId: lecturer.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });
    const collection = await createTestCollection({
      title: 'Bundle',
      ownerId: lecturer.id,
      resourceIds: [restrictedResource.id],
    });

    const client = createTestClient(app);
    await loginAs(client, member.email);
    const detail = asDetail((await client.get(`/api/v1/collections/${collection.id}`)).body);
    expect(detail.resources).toHaveLength(1);
    expect(detail.capabilities).toEqual({ canEdit: false, canDelete: false });
  });

  it('capabilities are true for the owning LECTURER and for an ADMIN on someone else’s collection', async () => {
    const lecturer = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const collection = await createTestCollection({ title: 'Mine', ownerId: lecturer.id });

    const ownerClient = createTestClient(app);
    await loginAs(ownerClient, lecturer.email);
    const ownerView = asDetail(
      (await ownerClient.get(`/api/v1/collections/${collection.id}`)).body,
    );
    expect(ownerView.capabilities).toEqual({ canEdit: true, canDelete: true });

    const adminClient = createTestClient(app);
    await loginAs(adminClient, admin.email);
    const adminView = asDetail(
      (await adminClient.get(`/api/v1/collections/${collection.id}`)).body,
    );
    expect(adminView.capabilities).toEqual({ canEdit: true, canDelete: true });
  });
});

describe('POST /api/v1/collections', () => {
  it('403s for a STUDENT', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/collections', {
      title: 'Should Fail',
      description: 'x',
      visibility: 'PUBLIC',
    });
    expect(response.status).toBe(403);
  });

  it('403s without a CSRF token', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await client.post('/api/v1/collections').send({
      title: 'No Token',
      description: 'x',
      visibility: 'PUBLIC',
    });
    expect(response.status).toBe(403);
    expect(asApiError(response.body).error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('201s for a LECTURER and the creator has full capabilities on it', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/collections', {
      title: 'New Collection',
      description: 'A description.',
      visibility: 'PUBLIC',
    });
    expect(response.status).toBe(201);
    const detail = asDetail(response.body);
    expect(detail.resources).toEqual([]);
    expect(detail.capabilities).toEqual({ canEdit: true, canDelete: true });
  });

  it('400s when restrictedToGroupIds references an unknown group', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/collections', {
      title: 'Bad Group',
      description: 'x',
      visibility: 'RESTRICTED',
      restrictedToGroupIds: ['00000000-0000-0000-0000-000000000000'],
    });
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/v1/collections/:id', () => {
  it('403s for a non-owning LECTURER, 200s for the owner, 200s for an ADMIN on anyone’s', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const collection = await createTestCollection({ title: 'Original', ownerId: owner.id });

    const otherClient = createTestClient(app);
    await loginAs(otherClient, otherLecturer.email);
    const deniedResponse = await patchWithCsrf(
      otherClient,
      `/api/v1/collections/${collection.id}`,
      {
        title: 'Hijacked',
      },
    );
    expect(deniedResponse.status).toBe(403);

    const ownerClient = createTestClient(app);
    await loginAs(ownerClient, owner.email);
    const ownerResponse = await patchWithCsrf(ownerClient, `/api/v1/collections/${collection.id}`, {
      title: 'Updated By Owner',
    });
    expect(ownerResponse.status).toBe(200);
    expect(asDetail(ownerResponse.body).title).toBe('Updated By Owner');

    const adminClient = createTestClient(app);
    await loginAs(adminClient, admin.email);
    const adminResponse = await patchWithCsrf(adminClient, `/api/v1/collections/${collection.id}`, {
      title: 'Updated By Admin',
    });
    expect(adminResponse.status).toBe(200);
  });

  it('omitted fields stay unchanged; an explicit null clears coverImageUrl', async () => {
    const owner = await createTestUser('LECTURER');
    const collection = await prisma.collection.update({
      where: {
        id: (await createTestCollection({ title: 'Has Cover', ownerId: owner.id })).id,
      },
      data: { coverImageUrl: 'https://example.edu/cover.png' },
      include: { items: true, groups: true },
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const afterTitleOnly = asDetail(
      (
        await patchWithCsrf(client, `/api/v1/collections/${collection.id}`, {
          title: 'Still Has Cover',
        })
      ).body,
    );
    expect(afterTitleOnly.coverImageUrl).toBe('https://example.edu/cover.png');

    const afterClearing = asDetail(
      (
        await patchWithCsrf(client, `/api/v1/collections/${collection.id}`, {
          coverImageUrl: null,
        })
      ).body,
    );
    expect(afterClearing.coverImageUrl).toBeNull();
  });

  it('400s when a PATCH would leave an already-RESTRICTED collection with no groups', async () => {
    const owner = await createTestUser('LECTURER');
    const group = await createGroup('Keepers');
    const collection = await createTestCollection({
      title: 'Restricted',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/collections/${collection.id}`, {
      restrictedToGroupIds: [],
    });
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/v1/collections/:id', () => {
  it('403s for a non-owner, 204s for the owner, and the collection is really gone afterward', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const collection = await createTestCollection({ title: 'To Delete', ownerId: owner.id });

    const otherClient = createTestClient(app);
    await loginAs(otherClient, otherLecturer.email);
    expect((await deleteWithCsrf(otherClient, `/api/v1/collections/${collection.id}`)).status).toBe(
      403,
    );

    const ownerClient = createTestClient(app);
    await loginAs(ownerClient, owner.email);
    expect((await deleteWithCsrf(ownerClient, `/api/v1/collections/${collection.id}`)).status).toBe(
      204,
    );
    expect((await ownerClient.get(`/api/v1/collections/${collection.id}`)).status).toBe(404);
  });
});

describe('POST /api/v1/collections/:id/resources (add)', () => {
  it('403s for a non-owner', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const collection = await createTestCollection({ title: 'Bundle', ownerId: owner.id });
    const resource = await createTestResource({ title: 'Some Resource', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);
    const response = await postWithCsrf(client, `/api/v1/collections/${collection.id}/resources`, {
      resourceId: resource.id,
    });
    expect(response.status).toBe(403);
  });

  it('400s for a nonexistent or inaccessible resourceId', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const group = await createGroup('Not Owner’s Group');
    const inaccessible = await createTestResource({
      title: 'Hidden Elsewhere',
      ownerId: admin.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });
    const collection = await createTestCollection({ title: 'Bundle', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const unknownIdResponse = await postWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources`,
      { resourceId: '00000000-0000-0000-0000-000000000000' },
    );
    expect(unknownIdResponse.status).toBe(400);

    const inaccessibleResponse = await postWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources`,
      { resourceId: inaccessible.id },
    );
    expect(inaccessibleResponse.status).toBe(400);
  });

  it('adds resources deterministically (insertion order becomes position order)', async () => {
    const owner = await createTestUser('LECTURER');
    const collection = await createTestCollection({ title: 'Bundle', ownerId: owner.id });
    const first = await createTestResource({ title: 'First', ownerId: owner.id });
    const second = await createTestResource({ title: 'Second', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    await postWithCsrf(client, `/api/v1/collections/${collection.id}/resources`, {
      resourceId: first.id,
    });
    const afterSecond = asDetail(
      (
        await postWithCsrf(client, `/api/v1/collections/${collection.id}/resources`, {
          resourceId: second.id,
        })
      ).body,
    );
    expect(afterSecond.resources.map((item) => item.resource.title)).toEqual(['First', 'Second']);
    expect(afterSecond.resources.map((item) => item.position)).toEqual([0, 1]);
  });

  it('adding an already-present resource is idempotent — no duplicate, 200 not an error', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Once', ownerId: owner.id });
    const collection = await createTestCollection({
      title: 'Bundle',
      ownerId: owner.id,
      resourceIds: [resource.id],
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await postWithCsrf(client, `/api/v1/collections/${collection.id}/resources`, {
      resourceId: resource.id,
    });
    expect(response.status).toBe(200);
    expect(asDetail(response.body).resources).toHaveLength(1);
  });
});

describe('DELETE /api/v1/collections/:id/resources/:resourceId (remove)', () => {
  it('403s for a non-owner', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'R', ownerId: owner.id });
    const collection = await createTestCollection({
      title: 'Bundle',
      ownerId: owner.id,
      resourceIds: [resource.id],
    });

    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);
    const response = await deleteWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/${resource.id}`,
    );
    expect(response.status).toBe(403);
  });

  it('200s and removes the item; removing it again is still 200 (idempotent)', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'R', ownerId: owner.id });
    const collection = await createTestCollection({
      title: 'Bundle',
      ownerId: owner.id,
      resourceIds: [resource.id],
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const first = await deleteWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/${resource.id}`,
    );
    expect(first.status).toBe(200);
    expect(asDetail(first.body).resources).toEqual([]);

    const second = await deleteWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/${resource.id}`,
    );
    expect(second.status).toBe(200);
  });

  it('a resource removed from the catalogue entirely is safely gone from the collection too (cascading FK)', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Doomed', ownerId: owner.id });
    const collection = await createTestCollection({
      title: 'Bundle',
      ownerId: owner.id,
      resourceIds: [resource.id],
    });

    await prisma.resource.delete({ where: { id: resource.id } });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const detail = asDetail((await client.get(`/api/v1/collections/${collection.id}`)).body);
    expect(detail.resources).toEqual([]);
  });
});

describe('PATCH /api/v1/collections/:id/resources/order (reorder)', () => {
  async function seedThreeItemCollection() {
    const owner = await createTestUser('LECTURER');
    const a = await createTestResource({ title: 'A', ownerId: owner.id });
    const b = await createTestResource({ title: 'B', ownerId: owner.id });
    const c = await createTestResource({ title: 'C', ownerId: owner.id });
    const collection = await createTestCollection({
      title: 'Orderable',
      ownerId: owner.id,
      resourceIds: [a.id, b.id, c.id],
    });
    return { owner, a, b, c, collection };
  }

  it('403s for a non-owner', async () => {
    const { collection, a, b, c } = await seedThreeItemCollection();
    const otherLecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);
    const response = await patchWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/order`,
      { resourceIds: [c.id, b.id, a.id] },
    );
    expect(response.status).toBe(403);
  });

  it('200s and atomically rewrites position to match the requested order', async () => {
    const { owner, a, b, c, collection } = await seedThreeItemCollection();
    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/order`,
      { resourceIds: [c.id, a.id, b.id] },
    );
    expect(response.status).toBe(200);
    expect(asDetail(response.body).resources.map((item) => item.resource.title)).toEqual([
      'C',
      'A',
      'B',
    ]);
  });

  it('400s on a mismatched set — missing an id, an extra id, or a duplicate', async () => {
    const { owner, a, b, collection } = await seedThreeItemCollection();
    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const missingOne = await patchWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/order`,
      { resourceIds: [a.id, b.id] },
    );
    expect(missingOne.status).toBe(400);

    const duplicated = await patchWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/order`,
      { resourceIds: [a.id, a.id, b.id] },
    );
    expect(duplicated.status).toBe(400);

    const unknownId = await patchWithCsrf(
      client,
      `/api/v1/collections/${collection.id}/resources/order`,
      { resourceIds: [a.id, b.id, '00000000-0000-0000-0000-000000000000'] },
    );
    expect(unknownId.status).toBe(400);
  });

  it('two concurrent reorder requests on the same collection both succeed and leave a valid, uncorrupted order', async () => {
    const { owner, a, b, c, collection } = await seedThreeItemCollection();
    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const [firstResponse, secondResponse] = await Promise.all([
      patchWithCsrf(client, `/api/v1/collections/${collection.id}/resources/order`, {
        resourceIds: [c.id, b.id, a.id],
      }),
      patchWithCsrf(client, `/api/v1/collections/${collection.id}/resources/order`, {
        resourceIds: [b.id, a.id, c.id],
      }),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const final = asDetail((await client.get(`/api/v1/collections/${collection.id}`)).body);
    const finalTitles = final.resources.map((item) => item.resource.title);
    // Whichever request's write committed last, the end state must be
    // a complete, valid permutation of exactly these three items — not
    // a partial/interleaved mix of both requested orders, and not a
    // duplicate or dropped item.
    expect(finalTitles.slice().sort()).toEqual(['A', 'B', 'C']);
    expect(new Set(finalTitles).size).toBe(3);
    expect([
      ['C', 'B', 'A'],
      ['B', 'A', 'C'],
    ]).toContainEqual(finalTitles);
  });
});
