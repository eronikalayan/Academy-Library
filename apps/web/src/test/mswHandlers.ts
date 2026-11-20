import { http, HttpResponse } from 'msw';
import { ZodError } from 'zod';
import type {
  ApiErrorResponse,
  AuthResponse,
  Bookmark,
  BookmarkListResponse,
  BookCopy,
  BookCopyListResponse,
  CollectionDetail,
  CollectionResourceItem,
  CollectionSummaryListResponse,
  CourseRef,
  DashboardStats,
  GroupRef,
  LearningPageResponse,
  Loan,
  LoanListResponse,
  PublicUser,
  ResourceSummary,
} from '@academy-library/contracts';
import {
  ResourceCreateInputSchema,
  ResourceListQuerySchema,
  ResourceUpdateInputSchema,
} from '@academy-library/contracts';
import { MOCK_STUDENT_USER } from './authFixtures';
import { isApiError } from '../shared/api/ApiError';
import { mockResourceRepository } from '../shared/data/resources';

const API_BASE_URL = '/api/v1';

export const MOCK_CSRF_TOKEN = 'test-csrf-token';

export function apiError(
  status: number,
  body: ApiErrorResponse,
): ReturnType<typeof HttpResponse.json> {
  return HttpResponse.json(body, { status });
}

export function authResponse(user: PublicUser): AuthResponse {
  return { user };
}

/**
 * The CSRF-token handler every test needs — `httpClient.ts` fetches it
 * ahead of every non-GET request, regardless of which auth flow a given
 * test is exercising.
 */
export const csrfTokenHandler = http.get(`${API_BASE_URL}/auth/csrf-token`, () =>
  HttpResponse.json({ csrfToken: MOCK_CSRF_TOKEN }),
);

export function loginHandler(user: PublicUser = MOCK_STUDENT_USER) {
  return http.post(`${API_BASE_URL}/auth/login`, () => HttpResponse.json(authResponse(user)));
}

export const invalidLoginHandler = http.post(`${API_BASE_URL}/auth/login`, () =>
  apiError(401, { error: { message: 'Invalid email or password', code: 'UNAUTHORIZED' } }),
);

export function registerHandler(user: PublicUser = MOCK_STUDENT_USER) {
  return http.post(`${API_BASE_URL}/auth/register`, () =>
    HttpResponse.json(authResponse(user), { status: 201 }),
  );
}

export const duplicateEmailHandler = http.post(`${API_BASE_URL}/auth/register`, () =>
  apiError(409, {
    error: { message: 'An account with this email already exists', code: 'CONFLICT' },
  }),
);

export const logoutHandler = http.post(
  `${API_BASE_URL}/auth/logout`,
  () => new HttpResponse(null, { status: 204 }),
);

export function meHandler(user: PublicUser | null = MOCK_STUDENT_USER) {
  return http.get(`${API_BASE_URL}/auth/me`, () =>
    user
      ? HttpResponse.json(authResponse(user))
      : apiError(401, { error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }),
  );
}

export const invalidCsrfHandler = http.post(`${API_BASE_URL}/auth/login`, () =>
  apiError(403, {
    error: { message: 'Invalid or missing CSRF token', code: 'INVALID_CSRF_TOKEN' },
  }),
);

/** The common "anonymous visitor, happy path available" baseline most
 * tests start from, then override individual handlers with `server.use`
 * for the specific scenario under test. */
export const defaultAuthHandlers = [
  csrfTokenHandler,
  meHandler(null),
  loginHandler(),
  registerHandler(),
  logoutHandler,
];

/** Builds the real `GET /resources` querystring back into a
 * `ResourceListQuery` the same way the real backend route does (notably
 * splitting the comma-joined `tags` param into an array before it
 * reaches the shared schema, which expects `tags` as `string[]` already
 * — see `apps/api/src/routes/resources.routes.ts`). */
function parseResourceListQuery(url: URL) {
  const params = url.searchParams;
  const raw: Record<string, unknown> = {};
  for (const key of [
    'search',
    'type',
    'difficulty',
    'courseId',
    'visibility',
    'sort',
    'page',
    'pageSize',
  ]) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  const tags = params.get('tags');
  if (tags !== null) raw.tags = tags.split(',').filter(Boolean);
  return ResourceListQuerySchema.parse(raw);
}

/**
 * Network-level stand-ins for the real `GET /resources`/`GET
 * /resources/:id` endpoints, backed by `mockResourceRepository` — this
 * is exactly the "isolated tests" use case `mockResourceRepository` is
 * still kept around for (see `shared/data/resources/index.ts`): the
 * same fixture data and filter/sort/pagination behavior the frontend
 * code used to get directly now arrives the same way production data
 * does, over MSW-intercepted HTTP, so these tests exercise the real
 * `HttpResourceRepository` wiring rather than bypassing it.
 */
export const resourceListHandler = http.get('/api/v1/resources', async ({ request }) => {
  const query = parseResourceListQuery(new URL(request.url));
  const result = await mockResourceRepository.list(query);
  return HttpResponse.json(result);
});

export const resourceDetailHandler = http.get('/api/v1/resources/:id', async ({ params }) => {
  const detail = await mockResourceRepository.getById(params.id as string);
  if (!detail) {
    return apiError(404, { error: { message: 'Resource not found', code: 'NOT_FOUND' } });
  }
  return HttpResponse.json(detail);
});

/** Converts a thrown `ZodError` (the real backend's own errorHandler.ts
 * does the identical translation for a raw schema-parse failure) or
 * `ApiError` (this mock's own `notFoundError`) into the same envelope
 * shape every mutation handler below needs, so a test exercising a
 * validation or not-found failure sees the real response shape. */
function toErrorResponse(error: unknown): ReturnType<typeof HttpResponse.json> {
  if (error instanceof ZodError) {
    return apiError(400, {
      error: {
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: error.flatten(),
      },
    });
  }
  if (isApiError(error)) {
    return apiError(error.status, {
      error: { message: error.message, code: error.code, details: error.details },
    });
  }
  throw error;
}

export const resourceCreateHandler = http.post('/api/v1/resources', async ({ request }) => {
  try {
    // Validated against the real request-shape schema first — same as
    // the real backend's route handler — rather than trusting whatever
    // JSON a test sends: a deliberately malformed body (missing title,
    // etc.) needs to produce the same `VALIDATION_ERROR` 400 a real
    // backend would, not whatever `mockResourceRepository.create` would
    // do with an unvalidated object.
    const body = ResourceCreateInputSchema.parse(await request.json());
    const created = await mockResourceRepository.create(body);
    return HttpResponse.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
});

export const resourceUpdateHandler = http.patch(
  '/api/v1/resources/:id',
  async ({ request, params }) => {
    try {
      const body = ResourceUpdateInputSchema.parse(await request.json());
      const updated = await mockResourceRepository.update(params.id as string, body);
      return HttpResponse.json(updated);
    } catch (error) {
      return toErrorResponse(error);
    }
  },
);

export const resourceDeleteHandler = http.delete('/api/v1/resources/:id', async ({ params }) => {
  try {
    await mockResourceRepository.delete(params.id as string);
    return new HttpResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
});

const MOCK_GROUPS: GroupRef[] = [
  { id: 'group-cs-staff', name: 'CS Department Staff' },
  { id: 'group-honors', name: 'Honors Cohort' },
];

export function coursesHandler(courses: CourseRef[]) {
  return http.get('/api/v1/courses', () => HttpResponse.json(courses));
}

export function groupsHandler(groups: GroupRef[] = MOCK_GROUPS) {
  return http.get('/api/v1/groups', () => HttpResponse.json(groups));
}

/** The full set of resource-mutation handlers a create/edit/delete test
 * typically needs together — `server.use(...defaultResourceWriteHandlers, meHandler(user))`. */
export const defaultResourceWriteHandlers = [
  resourceCreateHandler,
  resourceUpdateHandler,
  resourceDeleteHandler,
  coursesHandler([
    { id: 'course-algo', title: 'Algorithms & Data Structures' },
    { id: 'course-cs101', title: 'Introduction to Computer Science' },
  ]),
  groupsHandler(),
];

// ---------------------------------------------------------------------
// Collections (Task 06)
// ---------------------------------------------------------------------

const EMPTY_COLLECTION_LIST: CollectionSummaryListResponse = {
  items: [],
  page: 1,
  pageSize: 12,
  totalItems: 0,
  totalPages: 1,
};

/** Fixed-response handler for list-rendering/empty/error-state tests —
 * most Collections tests don't need real filter/sort/pagination logic,
 * just a specific response shape to render against. */
export function collectionListHandler(
  response: CollectionSummaryListResponse = EMPTY_COLLECTION_LIST,
) {
  return http.get('/api/v1/collections', () => HttpResponse.json(response));
}

export function collectionDetailHandler(detail: CollectionDetail | null) {
  return http.get('/api/v1/collections/:id', () =>
    detail
      ? HttpResponse.json(detail)
      : apiError(404, { error: { message: 'Collection not found', code: 'NOT_FOUND' } }),
  );
}

export const collectionCreateHandler = http.post('/api/v1/collections', async ({ request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const now = new Date().toISOString();
  const detail: CollectionDetail = {
    id: 'new-collection',
    title: typeof body.title === 'string' ? body.title : '',
    description: typeof body.description === 'string' ? body.description : '',
    coverImageUrl: (body.coverImageUrl as string | undefined) ?? null,
    visibility: (body.visibility as CollectionDetail['visibility']) ?? 'PUBLIC',
    restrictedToGroupIds: (body.restrictedToGroupIds as string[] | undefined) ?? [],
    capabilities: { canEdit: true, canDelete: true },
    resources: [],
    createdAt: now,
    updatedAt: now,
  };
  return HttpResponse.json(detail, { status: 201 });
});

/**
 * A minimal in-memory collection detail that mutation handlers below
 * read and write — enough statefulness to exercise a real add → remove
 * → reorder sequence against the same collection within one test,
 * without building a second full mock repository the way
 * `mockResourceRepository` backs the Resource domain's own MSW
 * handlers. Reset per test via `createStatefulCollectionHandlers`,
 * never shared across tests.
 */
export function createStatefulCollectionHandlers(initial: CollectionDetail) {
  let current: CollectionDetail = initial;

  const get = http.get('/api/v1/collections/:id', () => HttpResponse.json(current));

  const addResource = http.post('/api/v1/collections/:id/resources', async ({ request }) => {
    const body = (await request.json()) as { resourceId: string; resource?: ResourceSummary };
    if (!current.resources.some((item) => item.resource.id === body.resourceId)) {
      const resource = body.resource ?? {
        id: body.resourceId,
        title: `Resource ${body.resourceId}`,
        description: 'Added during a test.',
        type: 'ARTICLE',
        difficulty: 'BEGINNER',
        creator: { name: 'Test Creator' },
        coverImageUrl: null,
        courses: [],
        tags: [],
        durationSeconds: null,
        visibility: 'PUBLIC',
        publishedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newItem: CollectionResourceItem = { resource, position: current.resources.length };
      current = { ...current, resources: [...current.resources, newItem] };
    }
    return HttpResponse.json(current);
  });

  const removeResource = http.delete(
    '/api/v1/collections/:id/resources/:resourceId',
    ({ params }) => {
      current = {
        ...current,
        resources: current.resources.filter((item) => item.resource.id !== params.resourceId),
      };
      return HttpResponse.json(current);
    },
  );

  const reorder = http.patch('/api/v1/collections/:id/resources/order', async ({ request }) => {
    const body = (await request.json()) as { resourceIds: string[] };
    const byId = new Map(current.resources.map((item) => [item.resource.id, item.resource]));
    current = {
      ...current,
      resources: body.resourceIds.map((resourceId, position) => {
        const resource = byId.get(resourceId);
        if (!resource) throw new Error(`Test fixture missing resource ${resourceId}`);
        return { resource, position };
      }),
    };
    return HttpResponse.json(current);
  });

  return { get, addResource, removeResource, reorder };
}

// ---------------------------------------------------------------------
// Bookmarks (Task 06)
// ---------------------------------------------------------------------

const EMPTY_BOOKMARK_LIST: BookmarkListResponse = {
  items: [],
  page: 1,
  pageSize: 60,
  totalItems: 0,
  totalPages: 1,
};

/** Defaults to an empty list — any page that renders a Save/Saved
 * toggle (`ResourceDetailsPage`) or `/saved` calls `GET /bookmarks`,
 * so this is included in `defaultResourceWriteHandlers`-style handler
 * sets wherever that matters, matching how `meHandler`/`csrfTokenHandler`
 * are ambient dependencies most tests need regardless of what they're
 * actually testing. */
export function bookmarksHandler(response: BookmarkListResponse = EMPTY_BOOKMARK_LIST) {
  return http.get('/api/v1/bookmarks', () => HttpResponse.json(response));
}

/** Backs `GET /bookmarks/:resourceId/status` (Task 07) — the endpoint
 * `useIsResourceSaved` actually calls now, in place of deriving saved
 * status from a page of the list handler above. Defaults to `false`
 * ("not saved"), the same ambient-default convention `bookmarksHandler`
 * itself uses. */
export function bookmarkStatusHandler(isSaved = false) {
  return http.get('/api/v1/bookmarks/:resourceId/status', ({ params }) =>
    HttpResponse.json({ resourceId: params.resourceId, isSaved }),
  );
}

export function bookmarkFor(
  resource: ResourceSummary,
  createdAt = new Date().toISOString(),
): Bookmark {
  return { resource, createdAt };
}

export const bookmarkCreateHandler = http.post(
  '/api/v1/bookmarks',
  () => new HttpResponse(null, { status: 204 }),
);

export const bookmarkDeleteHandler = http.delete(
  '/api/v1/bookmarks/:resourceId',
  () => new HttpResponse(null, { status: 204 }),
);

// ---------------------------------------------------------------------
// Physical Library (Task 07)
// ---------------------------------------------------------------------

/** Defaults to an empty list — `ResourceDetailsPage` unconditionally
 * renders `PhysicalCopiesSection` for a `BOOK` resource, so any test
 * rendering one needs this registered, the same ambient-dependency
 * convention `bookmarkStatusHandler` follows. */
export function bookCopiesHandler(response: BookCopyListResponse = { items: [] }) {
  return http.get('/api/v1/resources/:resourceId/copies', () => HttpResponse.json(response));
}

export function bookCopyFor(overrides: Partial<BookCopy> = {}): BookCopy {
  return {
    id: 'copy-1',
    resourceId: 'res-1',
    inventoryCode: 'INV-001',
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const registerCopyHandler = http.post(
  '/api/v1/resources/:resourceId/copies',
  async ({ request, params }) => {
    const body = (await request.json()) as { inventoryCode: string };
    return HttpResponse.json(
      bookCopyFor({
        resourceId: params.resourceId as string,
        inventoryCode: body.inventoryCode,
      }),
      { status: 201 },
    );
  },
);

export const archiveCopyHandler = http.patch(
  '/api/v1/resources/:resourceId/copies/:copyId',
  ({ params }) =>
    HttpResponse.json(
      bookCopyFor({
        id: params.copyId as string,
        resourceId: params.resourceId as string,
        status: 'ARCHIVED',
      }),
    ),
);

// ---------------------------------------------------------------------
// Loans (Task 07)
// ---------------------------------------------------------------------

const EMPTY_LOAN_LIST: LoanListResponse = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
};

/** A minimal, valid `ResourceSummary` for tests that need *some* book
 * to attach a loan to and don't care about its specific fields. */
export function resourceSummaryFor(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
  return {
    id: 'res-1',
    title: 'A Borrowable Book',
    description: 'A book with physical copies.',
    type: 'BOOK',
    difficulty: 'BEGINNER',
    creator: { name: 'Test Author' },
    coverImageUrl: null,
    courses: [],
    tags: [],
    durationSeconds: null,
    visibility: 'PUBLIC',
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function loanFor(
  resource: ResourceSummary = resourceSummaryFor(),
  overrides: Partial<Loan> = {},
): Loan {
  return {
    id: 'loan-1',
    copy: { id: 'copy-1', inventoryCode: 'INV-001', resource },
    borrower: { id: 'user-1', displayName: 'Test User' },
    status: 'ACTIVE',
    borrowedAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    returnedAt: null,
    isOverdue: false,
    ...overrides,
  };
}

/** Backs `GET /loans` — the current user's own loans. */
export function loansHandler(response: LoanListResponse = EMPTY_LOAN_LIST) {
  return http.get('/api/v1/loans', () => HttpResponse.json(response));
}

/** Backs `GET /loans/all` — the ADMIN-only system-wide listing. */
export function allLoansHandler(response: LoanListResponse = EMPTY_LOAN_LIST) {
  return http.get('/api/v1/loans/all', () => HttpResponse.json(response));
}

export function borrowResourceHandler(loan: Loan = loanFor()) {
  return http.post('/api/v1/loans', () => HttpResponse.json(loan, { status: 201 }));
}

export function returnLoanHandler(
  loan: Loan = loanFor(resourceSummaryFor(), {
    status: 'RETURNED',
    returnedAt: new Date().toISOString(),
  }),
) {
  return http.patch('/api/v1/loans/:id', ({ params }) =>
    HttpResponse.json({ ...loan, id: params.id as string }),
  );
}

// ---------------------------------------------------------------------
// Dashboard (Task 07)
// ---------------------------------------------------------------------

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalAccessibleResources: 0,
  savedResourcesCount: 0,
  availableCollectionsCount: 0,
  activeLoansCount: 0,
  recentResources: [],
};

export function dashboardStatsHandler(stats: DashboardStats = EMPTY_DASHBOARD_STATS) {
  return http.get('/api/v1/dashboard', () => HttpResponse.json(stats));
}

// ---------------------------------------------------------------------
// My Learning (Task 07)
// ---------------------------------------------------------------------

const EMPTY_LEARNING_PAGE: LearningPageResponse = {
  courseGroups: [],
  relevantCollections: [],
  recentMaterials: [],
  recommendations: [],
};

export function learningPageHandler(response: LearningPageResponse = EMPTY_LEARNING_PAGE) {
  return http.get('/api/v1/learning', () => HttpResponse.json(response));
}
