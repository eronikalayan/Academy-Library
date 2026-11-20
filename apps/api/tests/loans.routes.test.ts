import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  LoanListResponseSchema,
  LoanSchema,
} from '@academy-library/contracts';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetAllTables } from './helpers/db.js';
import {
  TEST_USER_PASSWORD,
  createTestBookCopy,
  createTestLoan,
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
  return LoanListResponseSchema.parse(body);
}
function asLoan(body: unknown) {
  return LoanSchema.parse(body);
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

describe('POST /api/v1/loans', () => {
  it('401s for an unauthenticated request (with a valid CSRF token, so the auth check — not CSRF — is what is being tested)', async () => {
    const client = createTestClient(app);
    const response = await postWithCsrf(client, '/api/v1/loans', { resourceId: 'anything' });
    expect(response.status).toBe(401);
  });

  it('403s without a CSRF token', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.post('/api/v1/loans').send({ resourceId: 'anything' });
    expect(response.status).toBe(403);
    expect(asApiError(response.body).error.code).toBe('INVALID_CSRF_TOKEN');
  });

  it('404s for a nonexistent resource', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/loans', {
      resourceId: '00000000-0000-0000-0000-000000000000',
    });
    expect(response.status).toBe(404);
  });

  it('400s for a non-BOOK resource', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({
      title: 'An Article',
      ownerId: owner.id,
      type: 'ARTICLE',
    });
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/loans', { resourceId: resource.id });
    expect(response.status).toBe(400);
  });

  it('201s, creates an ACTIVE loan, and flips the copy to ON_LOAN', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/loans', { resourceId: resource.id });
    expect(response.status).toBe(201);
    const loan = asLoan(response.body);
    expect(loan.status).toBe('ACTIVE');
    expect(loan.copy.resource.id).toBe(resource.id);
    expect(loan.borrower.id).toBe(student.id);
    expect(new Date(loan.dueAt).getTime()).toBeGreaterThan(new Date(loan.borrowedAt).getTime());

    const copyRow = await prisma.bookCopy.findUniqueOrThrow({ where: { inventoryCode: 'INV-1' } });
    expect(copyRow.status).toBe('ON_LOAN');
  });

  it('picks the available copy with the lowest inventory code, deterministically', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-Z' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-A' });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/loans', { resourceId: resource.id });
    expect(asLoan(response.body).copy.inventoryCode).toBe('INV-A');
  });

  it('409s when this user already has an active loan for the same resource, even if another copy is free', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-2' });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const first = await postWithCsrf(client, '/api/v1/loans', { resourceId: resource.id });
    expect(first.status).toBe(201);

    const second = await postWithCsrf(client, '/api/v1/loans', { resourceId: resource.id });
    expect(second.status).toBe(409);
  });

  it('409s when no copies are currently available', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-1',
      status: 'ON_LOAN',
    });
    await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-2',
      status: 'ARCHIVED',
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await postWithCsrf(client, '/api/v1/loans', { resourceId: resource.id });
    expect(response.status).toBe(409);
  });

  it('a different user CAN still borrow a different copy of the same resource concurrently', async () => {
    const owner = await createTestUser('LECTURER');
    const studentA = await createTestUser('STUDENT');
    const studentB = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-1' });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-2' });

    const clientA = createTestClient(app);
    await loginAs(clientA, studentA.email);
    const clientB = createTestClient(app);
    await loginAs(clientB, studentB.email);

    const [responseA, responseB] = await Promise.all([
      postWithCsrf(clientA, '/api/v1/loans', { resourceId: resource.id }),
      postWithCsrf(clientB, '/api/v1/loans', { resourceId: resource.id }),
    ]);
    expect(responseA.status).toBe(201);
    expect(responseB.status).toBe(201);
    expect(asLoan(responseA.body).copy.inventoryCode).not.toBe(
      asLoan(responseB.body).copy.inventoryCode,
    );
  });

  it('prevents double-booking: two concurrent borrow requests for the one remaining copy — exactly one succeeds', async () => {
    const owner = await createTestUser('LECTURER');
    const studentA = await createTestUser('STUDENT');
    const studentB = await createTestUser('STUDENT');
    const resource = await createTestResource({
      title: 'Last Copy Book',
      ownerId: owner.id,
      type: 'BOOK',
    });
    await createTestBookCopy({ resourceId: resource.id, inventoryCode: 'INV-ONLY' });

    const clientA = createTestClient(app);
    await loginAs(clientA, studentA.email);
    const clientB = createTestClient(app);
    await loginAs(clientB, studentB.email);

    const [responseA, responseB] = await Promise.all([
      postWithCsrf(clientA, '/api/v1/loans', { resourceId: resource.id }),
      postWithCsrf(clientB, '/api/v1/loans', { resourceId: resource.id }),
    ]);

    const statuses = [responseA.status, responseB.status].sort();
    expect(statuses).toEqual([201, 409]);

    // The database itself must agree: exactly one ACTIVE loan for this
    // copy, and the copy is ON_LOAN, not some corrupted in-between state.
    const copyRow = await prisma.bookCopy.findUniqueOrThrow({
      where: { inventoryCode: 'INV-ONLY' },
    });
    expect(copyRow.status).toBe('ON_LOAN');
    const activeLoans = await prisma.loan.findMany({
      where: { copyId: copyRow.id, status: 'ACTIVE' },
    });
    expect(activeLoans).toHaveLength(1);
  });
});

describe('PATCH /api/v1/loans/:id (return)', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await patchWithCsrf(client, '/api/v1/loans/anything', { status: 'RETURNED' });
    expect(response.status).toBe(401);
  });

  it('403s for a non-ADMIN, including the loan’s own borrower', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const copy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-1',
      status: 'ON_LOAN',
    });
    const loan = await createTestLoan({ copyId: copy.id, userId: student.id });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await patchWithCsrf(client, `/api/v1/loans/${loan.id}`, {
      status: 'RETURNED',
    });
    expect(response.status).toBe(403);
  });

  it('400s for any status other than RETURNED — an invalid transition rejected at the contract layer', async () => {
    const admin = await createTestUser('ADMIN');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-1',
      status: 'ON_LOAN',
    });
    const loan = await createTestLoan({ copyId: copy.id, userId: student.id });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await patchWithCsrf(client, `/api/v1/loans/${loan.id}`, { status: 'ACTIVE' });
    expect(response.status).toBe(400);
  });

  it('404s for a nonexistent loan', async () => {
    const admin = await createTestUser('ADMIN');
    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const response = await patchWithCsrf(
      client,
      '/api/v1/loans/00000000-0000-0000-0000-000000000000',
      { status: 'RETURNED' },
    );
    expect(response.status).toBe(404);
  });

  it('200s, marks the loan RETURNED, and flips the copy back to AVAILABLE; returning it again is idempotent', async () => {
    const admin = await createTestUser('ADMIN');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: admin.id, type: 'BOOK' });
    const copy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-1',
      status: 'ON_LOAN',
    });
    const loan = await createTestLoan({ copyId: copy.id, userId: student.id });

    const client = createTestClient(app);
    await loginAs(client, admin.email);

    const first = await patchWithCsrf(client, `/api/v1/loans/${loan.id}`, { status: 'RETURNED' });
    expect(first.status).toBe(200);
    expect(asLoan(first.body).status).toBe('RETURNED');
    expect(asLoan(first.body).returnedAt).not.toBeNull();

    const copyRow = await prisma.bookCopy.findUniqueOrThrow({ where: { id: copy.id } });
    expect(copyRow.status).toBe('AVAILABLE');

    const second = await patchWithCsrf(client, `/api/v1/loans/${loan.id}`, { status: 'RETURNED' });
    expect(second.status).toBe(200);
  });
});

describe('GET /api/v1/loans (self)', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/loans');
    expect(response.status).toBe(401);
  });

  it('is empty for a user with no loans', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asList((await client.get('/api/v1/loans')).body);
    expect(body.items).toEqual([]);
  });

  it('only ever lists the caller’s own loans, never another user’s (user-specific loan history)', async () => {
    const owner = await createTestUser('LECTURER');
    const studentA = await createTestUser('STUDENT');
    const studentB = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const copyA = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-A',
      status: 'ON_LOAN',
    });
    const copyB = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-B',
      status: 'ON_LOAN',
    });
    await createTestLoan({ copyId: copyA.id, userId: studentA.id });
    await createTestLoan({ copyId: copyB.id, userId: studentB.id });

    const clientA = createTestClient(app);
    await loginAs(clientA, studentA.email);
    const bodyA = asList((await clientA.get('/api/v1/loans')).body);
    expect(bodyA.items).toHaveLength(1);
    expect(bodyA.items[0]?.copy.inventoryCode).toBe('INV-A');
  });

  it('marks a loan isOverdue when its dueAt is in the past and it is still ACTIVE', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const copy = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-1',
      status: 'ON_LOAN',
    });
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await createTestLoan({
      copyId: copy.id,
      userId: student.id,
      borrowedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dueAt: pastDue,
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);
    const body = asList((await client.get('/api/v1/loans')).body);
    expect(body.items[0]?.isOverdue).toBe(true);
  });

  it('filters by status', async () => {
    const owner = await createTestUser('LECTURER');
    const student = await createTestUser('STUDENT');
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
    await createTestLoan({ copyId: activeCopy.id, userId: student.id, status: 'ACTIVE' });
    await createTestLoan({
      copyId: returnedCopy.id,
      userId: student.id,
      status: 'RETURNED',
      returnedAt: new Date(),
    });

    const client = createTestClient(app);
    await loginAs(client, student.email);

    const activeOnly = asList((await client.get('/api/v1/loans?status=ACTIVE')).body);
    expect(activeOnly.items.map((item) => item.copy.inventoryCode)).toEqual(['INV-ACTIVE']);

    const returnedOnly = asList((await client.get('/api/v1/loans?status=RETURNED')).body);
    expect(returnedOnly.items.map((item) => item.copy.inventoryCode)).toEqual(['INV-RETURNED']);
  });
});

describe('GET /api/v1/loans/all (admin)', () => {
  it('401s for an unauthenticated request', async () => {
    const client = createTestClient(app);
    const response = await client.get('/api/v1/loans/all');
    expect(response.status).toBe(401);
  });

  it('403s for a non-ADMIN', async () => {
    const student = await createTestUser('STUDENT');
    const client = createTestClient(app);
    await loginAs(client, student.email);
    const response = await client.get('/api/v1/loans/all');
    expect(response.status).toBe(403);
  });

  it('200s and lists loans from every user, with borrower info, for an ADMIN', async () => {
    const owner = await createTestUser('LECTURER');
    const admin = await createTestUser('ADMIN');
    const studentA = await createTestUser('STUDENT', 'Student A');
    const studentB = await createTestUser('STUDENT', 'Student B');
    const resource = await createTestResource({ title: 'Book', ownerId: owner.id, type: 'BOOK' });
    const copyA = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-A',
      status: 'ON_LOAN',
    });
    const copyB = await createTestBookCopy({
      resourceId: resource.id,
      inventoryCode: 'INV-B',
      status: 'ON_LOAN',
    });
    await createTestLoan({ copyId: copyA.id, userId: studentA.id });
    await createTestLoan({ copyId: copyB.id, userId: studentB.id });

    const client = createTestClient(app);
    await loginAs(client, admin.email);
    const body = asList((await client.get('/api/v1/loans/all')).body);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item) => item.borrower.displayName).sort()).toEqual([
      'Student A',
      'Student B',
    ]);
  });
});
