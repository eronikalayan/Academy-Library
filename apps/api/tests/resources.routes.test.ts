import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  ResourceDetailSchema,
  ResourceSummaryListResponseSchema,
} from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  addUserToGroup,
  createCourse,
  createGroup,
  createTestBookCopy,
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
  return ResourceSummaryListResponseSchema.parse(body);
}
function asDetail(body: unknown) {
  return ResourceDetailSchema.parse(body);
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

// See auth.routes.test.ts's identical `afterAll` for why this resets
// again on the way out, not just on the way in (Task 05D).
afterAll(async () => {
  await resetAllTables();
  await prisma.$disconnect();
});

const VALID_CREATE_INPUT = {
  title: 'A Valid Article',
  description: 'Enough words to pass validation.',
  type: 'ARTICLE',
  difficulty: 'BEGINNER',
  creator: { name: 'Test Author' },
  tags: ['testing'],
  courseIds: [],
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
};

describe('GET /api/v1/resources (list)', () => {
  it('returns only PUBLIC resources for an anonymous request', async () => {
    const owner = await createTestUser('LECTURER');
    const group = await createGroup('Staff');
    await createTestResource({ title: 'Public One', ownerId: owner.id, visibility: 'PUBLIC' });
    await createTestResource({
      title: 'Restricted One',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    const response = await client.get('/api/v1/resources?pageSize=50');

    expect(response.status).toBe(200);
    const body = asList(response.body);
    expect(body.totalItems).toBe(1);
    expect(body.items.map((item) => item.title)).toEqual(['Public One']);
  });

  it('includes a RESTRICTED resource for a group member, excludes it for a non-member', async () => {
    const owner = await createTestUser('LECTURER');
    const member = await createTestUser('STUDENT');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Honors');
    await addUserToGroup(member.id, group.id);
    await createTestResource({
      title: 'Honors Only',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const memberClient = createTestClient(app);
    await loginAs(memberClient, member.email);
    const memberResponse = asList((await memberClient.get('/api/v1/resources?pageSize=50')).body);
    expect(memberResponse.totalItems).toBe(1);

    const outsiderClient = createTestClient(app);
    await loginAs(outsiderClient, outsider.email);
    const outsiderResponse = asList(
      (await outsiderClient.get('/api/v1/resources?pageSize=50')).body,
    );
    expect(outsiderResponse.totalItems).toBe(0);
  });

  it('includes a RESTRICTED resource for its owner even if not a group member', async () => {
    const owner = await createTestUser('LECTURER');
    const group = await createGroup('Some Group');
    await createTestResource({
      title: 'Owned But Restricted',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const body = asList((await client.get('/api/v1/resources?pageSize=50')).body);
    expect(body.totalItems).toBe(1);
  });

  it('includes every RESTRICTED resource for an ADMIN', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const group = await createGroup('Some Group');
    await createTestResource({
      title: 'Restricted A',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const body = asList((await client.get('/api/v1/resources?pageSize=50')).body);
    expect(body.totalItems).toBe(1);
  });

  it('ranks a title match above a tag-only match when searching', async () => {
    const owner = await createTestUser('LECTURER');
    await createTestResource({ title: 'Algorithms Explained', ownerId: owner.id, tags: ['intro'] });
    await createTestResource({ title: 'Something Else', ownerId: owner.id, tags: ['algorithms'] });

    const client = createTestClient(app);
    const body = asList(
      (await client.get('/api/v1/resources?search=algorithms&sort=relevance')).body,
    );

    expect(body.items.map((item) => item.title)).toEqual([
      'Algorithms Explained',
      'Something Else',
    ]);
  });

  it('combines a search term with a type filter', async () => {
    const owner = await createTestUser('LECTURER');
    await createTestResource({ title: 'Algorithms Book', type: 'BOOK', ownerId: owner.id });
    await createTestResource({
      title: 'Algorithms Video',
      type: 'VIDEO',
      ownerId: owner.id,
      durationSeconds: 60,
    });

    const client = createTestClient(app);
    const body = asList((await client.get('/api/v1/resources?search=algorithms&type=VIDEO')).body);

    expect(body.items.map((item) => item.title)).toEqual(['Algorithms Video']);
  });

  it('treats multiple selected tags as OR, not AND', async () => {
    const owner = await createTestUser('LECTURER');
    await createTestResource({ title: 'Tag A', ownerId: owner.id, tags: ['alpha'] });
    await createTestResource({ title: 'Tag B', ownerId: owner.id, tags: ['beta'] });
    await createTestResource({ title: 'Tag C', ownerId: owner.id, tags: ['gamma'] });

    const client = createTestClient(app);
    const body = asList((await client.get('/api/v1/resources?tags=alpha,beta')).body);

    expect(body.items.map((item) => item.title).sort()).toEqual(['Tag A', 'Tag B']);
  });

  it('sorts title_asc alphabetically', async () => {
    const owner = await createTestUser('LECTURER');
    await createTestResource({ title: 'Zebra', ownerId: owner.id });
    await createTestResource({ title: 'Apple', ownerId: owner.id });

    const client = createTestClient(app);
    const body = asList((await client.get('/api/v1/resources?sort=title_asc')).body);

    expect(body.items.map((item) => item.title)).toEqual(['Apple', 'Zebra']);
  });

  it('computes totalItems/totalPages AFTER authorization filtering, not before', async () => {
    const owner = await createTestUser('LECTURER');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Private');
    await createTestResource({ title: 'Visible', ownerId: owner.id, visibility: 'PUBLIC' });
    await createTestResource({
      title: 'Hidden',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, outsider.email);
    const body = asList((await client.get('/api/v1/resources?pageSize=1')).body);

    expect(body.totalItems).toBe(1);
    expect(body.totalPages).toBe(1);
  });

  it('returns a correct, empty result for a page beyond the last one', async () => {
    const owner = await createTestUser('LECTURER');
    await createTestResource({ title: 'Only One', ownerId: owner.id });

    const client = createTestClient(app);
    const response = await client.get('/api/v1/resources?page=50');
    const body = asList(response.body);

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.page).toBe(50);
    expect(body.totalItems).toBe(1);
  });

  it('rejects a pageSize above the bounded maximum', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/resources?pageSize=1000');
    expect(response.status).toBe(400);
    expect(asApiError(response.body).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/resources/:id (detail)', () => {
  it('returns a PUBLIC resource to an anonymous request', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Open Book', ownerId: owner.id });

    const client = createTestClient(app);
    const response = await client.get(`/api/v1/resources/${resource.id}`);

    expect(response.status).toBe(200);
    expect(asDetail(response.body).title).toBe('Open Book');
  });

  it('404s for an id that does not exist', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/resources/00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
  });

  it('404s (not 403) for a RESTRICTED resource the actor cannot see, hiding its existence', async () => {
    const owner = await createTestUser('LECTURER');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Private');
    const resource = await createTestResource({
      title: 'Secret',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, outsider.email);
    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(404);
  });

  it('200s for a RESTRICTED resource when the actor is a member of a permitted group', async () => {
    const owner = await createTestUser('LECTURER');
    const member = await createTestUser('STUDENT');
    const group = await createGroup('Permitted');
    await addUserToGroup(member.id, group.id);
    const resource = await createTestResource({
      title: 'Members Only',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, member.email);
    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(200);
  });

  it('list and detail agree on visibility for the same actor and resource', async () => {
    const owner = await createTestUser('LECTURER');
    const outsider = await createTestUser('STUDENT');
    const group = await createGroup('Private');
    const resource = await createTestResource({
      title: 'Consistency Check',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, outsider.email);

    const detailResponse = await client.get(`/api/v1/resources/${resource.id}`);
    const listBody = asList((await client.get('/api/v1/resources?pageSize=50')).body);

    expect(detailResponse.status).toBe(404);
    expect(listBody.items.some((item) => item.title === 'Consistency Check')).toBe(false);
  });
});

describe('POST /api/v1/resources (create)', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await postWithCsrf(client, '/api/v1/resources', VALID_CREATE_INPUT);
    expect(response.status).toBe(401);
  });

  it('403s for a STUDENT', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/resources', VALID_CREATE_INPUT);
    expect(response.status).toBe(403);
  });

  it('201s for a LECTURER and sets them as owner (verified via a later ownership check)', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await postWithCsrf(client, '/api/v1/resources', VALID_CREATE_INPUT);
    expect(response.status).toBe(201);
    const detail = asDetail(response.body);
    expect(detail.title).toBe(VALID_CREATE_INPUT.title);
    expect('ownerId' in response.body).toBe(false);

    const row = await prisma.resource.findUnique({ where: { id: detail.id } });
    expect(row?.ownerId).toBe(lecturer.id);
  });

  it('201s for an ADMIN', async () => {
    const admin = await createTestUser('ADMIN');
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await postWithCsrf(client, '/api/v1/resources', VALID_CREATE_INPUT);
    expect(response.status).toBe(201);
  });

  it('rejects a VIDEO with no durationSeconds', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      type: 'VIDEO',
    });
    expect(response.status).toBe(400);
  });

  it('rejects an EXERCISE that includes durationSeconds', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      type: 'EXERCISE',
      durationSeconds: 60,
    });
    expect(response.status).toBe(400);
  });

  it('rejects an unknown courseId', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      courseIds: ['00000000-0000-0000-0000-000000000000'],
    });
    expect(response.status).toBe(400);
  });

  it('rejects an unknown restrictedToGroupIds entry', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      visibility: 'RESTRICTED',
      restrictedToGroupIds: ['00000000-0000-0000-0000-000000000000'],
    });
    expect(response.status).toBe(400);
  });

  it('rejects RESTRICTED visibility with an empty restrictedToGroupIds (contract-level)', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      visibility: 'RESTRICTED',
      restrictedToGroupIds: [],
    });
    expect(response.status).toBe(400);
  });

  it('creates a new tag on demand and normalizes its casing', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      title: 'Tag Creation Test',
      tags: ['Brand-New-Tag'],
    });
    expect(response.status).toBe(201);

    const tag = await prisma.tag.findUnique({ where: { name: 'brand-new-tag' } });
    expect(tag).not.toBeNull();

    const listBody = asList((await client.get('/api/v1/resources?tags=brand-new-tag')).body);
    expect(listBody.items.map((item) => item.title)).toEqual(['Tag Creation Test']);
  });

  it('collapses two differently-cased submissions of the same tag into one row', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      title: 'First',
      tags: ['Shared'],
    });
    await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      title: 'Second',
      tags: ['shared'],
    });

    const count = await prisma.tag.count({ where: { name: 'shared' } });
    expect(count).toBe(1);
  });
});

describe('PATCH /api/v1/resources/:id (update)', () => {
  it('401s for an unauthenticated request', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'X', ownerId: owner.id });
    const client = createTestClient(app);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Y',
    });
    expect(response.status).toBe(401);
  });

  it('404s for an id that does not exist', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await patchWithCsrf(
      client,
      '/api/v1/resources/00000000-0000-0000-0000-000000000000',
      { title: 'Y' },
    );
    expect(response.status).toBe(404);
  });

  it('404s for a resource the actor cannot even see (restricted, non-member, non-owner)', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const group = await createGroup('Private');
    const resource = await createTestResource({
      title: 'Hidden',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Y',
    });
    expect(response.status).toBe(404);
  });

  it('403s for a LECTURER editing a visible PUBLIC resource they do not own', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Not Yours', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Hijacked',
    });
    expect(response.status).toBe(403);
  });

  it('200s for the owning LECTURER and leaves every omitted field unchanged', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({
      title: 'Original Title',
      ownerId: owner.id,
      tags: ['keep-me'],
      difficulty: 'ADVANCED',
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Updated Title',
    });

    expect(response.status).toBe(200);
    const detail = asDetail(response.body);
    expect(detail.title).toBe('Updated Title');
    expect(detail.difficulty).toBe('ADVANCED');
    expect(detail.tags).toEqual(['keep-me']);
  });

  it('explicit null clears a nullable field', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Has Publisher', ownerId: owner.id });
    await prisma.resource.update({ where: { id: resource.id }, data: { publisher: 'Some Press' } });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      publisher: null,
    });

    expect(response.status).toBe(200);
    expect(asDetail(response.body).publisher).toBeNull();
  });

  it('200s for an ADMIN editing a resource owned by someone else', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Not Admins', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Edited',
    });
    expect(response.status).toBe(200);
  });

  it('rejects clearing restrictedToGroupIds on an already-RESTRICTED resource when visibility is omitted', async () => {
    const owner = await createTestUser('LECTURER');
    const group = await createGroup('Private');
    const resource = await createTestResource({
      title: 'Was Restricted',
      ownerId: owner.id,
      visibility: 'RESTRICTED',
      groupIds: [group.id],
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      restrictedToGroupIds: [],
    });
    expect(response.status).toBe(400);
  });

  it('rejects changing type away from VIDEO without clearing durationSeconds', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({
      title: 'Was A Video',
      ownerId: owner.id,
      type: 'VIDEO',
      durationSeconds: 300,
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      type: 'BOOK',
    });
    expect(response.status).toBe(400);
  });

  it('allows changing type away from VIDEO when durationSeconds is cleared in the same request', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({
      title: 'Was A Video Too',
      ownerId: owner.id,
      type: 'VIDEO',
      durationSeconds: 300,
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      type: 'BOOK',
      durationSeconds: null,
    });
    expect(response.status).toBe(200);
    const detail = asDetail(response.body);
    expect(detail.type).toBe('BOOK');
    if (detail.type === 'BOOK') {
      expect('durationSeconds' in detail).toBe(false);
    }
  });

  it('rejects an unknown courseId on update', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'X', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      courseIds: ['00000000-0000-0000-0000-000000000000'],
    });
    expect(response.status).toBe(400);
  });

  it('replaces the tag set entirely rather than merging into it', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({
      title: 'Tagged',
      ownerId: owner.id,
      tags: ['old-tag'],
    });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      tags: ['new-tag'],
    });

    expect(response.status).toBe(200);
    expect(asDetail(response.body).tags).toEqual(['new-tag']);
  });
});

describe('DELETE /api/v1/resources/:id', () => {
  it('401s for an unauthenticated request', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'X', ownerId: owner.id });
    const client = createTestClient(app);
    const response = await deleteWithCsrf(client, `/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(401);
  });

  it('404s for an id that does not exist', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const response = await deleteWithCsrf(
      client,
      '/api/v1/resources/00000000-0000-0000-0000-000000000000',
    );
    expect(response.status).toBe(404);
  });

  it('403s for a LECTURER deleting a visible resource they do not own', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Not Yours', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);
    const response = await deleteWithCsrf(client, `/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(403);
  });

  it('204s for the owning LECTURER and genuinely removes the row (and its join rows)', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Doomed', ownerId: owner.id, tags: ['t1'] });

    const client = createTestClient(app);
    await loginAs(client, owner.email);
    const response = await deleteWithCsrf(client, `/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(204);

    const row = await prisma.resource.findUnique({ where: { id: resource.id } });
    expect(row).toBeNull();
    const joinRows = await prisma.resourceTag.findMany({ where: { resourceId: resource.id } });
    expect(joinRows).toEqual([]);

    const followUp = await client.get(`/api/v1/resources/${resource.id}`);
    expect(followUp.status).toBe(404);
  });

  it('204s for an ADMIN deleting a resource owned by someone else', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Not Admins', ownerId: owner.id });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await deleteWithCsrf(client, `/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(204);
  });

  it('409s deleting a BOOK resource with physical copies on record (Task 07) — even an ARCHIVED one', async () => {
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({
      title: 'Has Copies',
      ownerId: admin.id,
      type: 'BOOK',
    });
    await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-GUARD',
      status: 'ARCHIVED',
    });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await deleteWithCsrf(client, `/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(409);

    const row = await prisma.resource.findUnique({ where: { id: resource.id } });
    expect(row).not.toBeNull();
  });
});

describe('CSRF and origin protection on /api/v1/resources', () => {
  it('rejects a POST with no CSRF token', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await client.post('/api/v1/resources').send(VALID_CREATE_INPUT);
    expect(response.status).toBe(403);
    expect(asApiError(response.body).error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('rejects a POST from an unrecognized Origin', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);
    const csrfToken = await client.csrfToken();

    const response = await client
      .post('/api/v1/resources')
      .set('Origin', 'https://evil.example.com')
      .set('x-csrf-token', csrfToken)
      .send(VALID_CREATE_INPUT);
    expect(response.status).toBe(403);
  });
});

describe('Course/tag association validation uses real database records', () => {
  it('accepts a real courseId and reflects it on read', async () => {
    const lecturer = await createTestUser('LECTURER');
    const course = await createCourse('Test Course 101');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await postWithCsrf(client, '/api/v1/resources', {
      ...VALID_CREATE_INPUT,
      title: 'Course-Linked',
      courseIds: [course.id],
    });

    expect(response.status).toBe(201);
    const detail = asDetail(response.body);
    expect(detail.courses).toEqual([{ id: course.id, title: 'Test Course 101' }]);
  });
});

describe('Resource capabilities (Task 05C.3)', () => {
  it('gives the owning LECTURER canEdit/canDelete on their own resource', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Mine', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: true, canDelete: true });
  });

  it('denies capabilities to a different LECTURER who does not own the resource', async () => {
    const owner = await createTestUser('LECTURER');
    const otherLecturer = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Not Yours', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, otherLecturer.email);

    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: false, canDelete: false });
  });

  it('gives an ADMIN capabilities on a resource owned by someone else', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Not Admins', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, admin.email);

    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: true, canDelete: true });
  });

  it('denies capabilities to a STUDENT', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Public Thing', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, student.email);

    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: false, canDelete: false });
  });

  it('denies capabilities to an anonymous visitor', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Public Thing', ownerId: owner.id });
    const client = createTestClient(app);

    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: false, canDelete: false });
  });

  it('reflects true capabilities on the create response for the creating LECTURER', async () => {
    const lecturer = await createTestUser('LECTURER');
    const client = createTestClient(app);
    await loginAs(client, lecturer.email);

    const response = await postWithCsrf(client, '/api/v1/resources', VALID_CREATE_INPUT);
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: true, canDelete: true });
  });

  it('reflects true capabilities on the update response for an ADMIN editing someone else’s resource', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const resource = await createTestResource({ title: 'Admin Edits This', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, admin.email);

    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Admin Edited This',
    });
    expect(asDetail(response.body).capabilities).toEqual({ canEdit: true, canDelete: true });
  });

  it('never includes an ownerId alongside capabilities', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Mine', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const response = await client.get(`/api/v1/resources/${resource.id}`);
    expect('ownerId' in response.body).toBe(false);
  });
});

describe('STUDENT is denied write access regardless of visibility (Task 05C.3 gap-fill)', () => {
  it('403s a STUDENT attempting to update a PUBLIC resource', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Public Thing', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, student.email);

    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      title: 'Hijacked',
    });
    expect(response.status).toBe(403);
  });

  it('403s a STUDENT attempting to delete a PUBLIC resource', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Public Thing', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, student.email);

    const response = await deleteWithCsrf(client, `/api/v1/resources/${resource.id}`);
    expect(response.status).toBe(403);
  });

  it('rejects an unknown restrictedToGroupIds entry on update, not just on create', async () => {
    const owner = await createTestUser('LECTURER');
    const resource = await createTestResource({ title: 'Mine', ownerId: owner.id });
    const client = createTestClient(app);
    await loginAs(client, owner.email);

    const response = await patchWithCsrf(client, `/api/v1/resources/${resource.id}`, {
      visibility: 'RESTRICTED',
      restrictedToGroupIds: ['00000000-0000-0000-0000-000000000000'],
    });
    expect(response.status).toBe(400);
  });
});
