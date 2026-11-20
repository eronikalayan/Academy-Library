import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import type { ResourceDetail } from '@academy-library/contracts';
import { resourceRepository } from '../../shared/data/resources';
import { server } from '../../test/mswServer';
import {
  apiError,
  bookCopiesHandler,
  bookCopyFor,
  bookmarkStatusHandler,
  borrowResourceHandler,
  csrfTokenHandler,
  meHandler,
  resourceDetailHandler,
} from '../../test/mswHandlers';
import { MOCK_ADMIN_USER, MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ResourceDetailsPage } from './ResourceDetailsPage';

const MANAGEABLE_RESOURCE: ResourceDetail = {
  id: 'res-managed',
  type: 'ARTICLE',
  title: 'A Manageable Article',
  description: 'Something.',
  difficulty: 'BEGINNER',
  creator: { name: 'Jane Doe' },
  coverImageUrl: null,
  sourceUrl: null,
  tags: [],
  courses: [],
  publishedAt: null,
  publisher: null,
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  capabilities: { canEdit: true, canDelete: true },
};

const MANAGEABLE_BOOK_RESOURCE: ResourceDetail = {
  ...MANAGEABLE_RESOURCE,
  id: 'res-managed-book',
  type: 'BOOK',
  title: 'A Manageable Book',
};

afterEach(() => {
  vi.restoreAllMocks();
});

function renderAt(resourceId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/library/:resourceId" element={<ResourceDetailsPage />} />
      <Route path="/library" element={<p>Library stub</p>} />
    </Routes>,
    { route: `/library/${resourceId}` },
  );
}

describe('ResourceDetailsPage', () => {
  it('renders title, type, difficulty, creator, description, courses, and tags for a known resource', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    renderAt('res-001');

    expect(
      await screen.findByRole('heading', { name: 'Introduction to Algorithms' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('R. Kesari')).toBeInTheDocument();
    expect(screen.getByText(/standard reference on algorithms/)).toBeInTheDocument();
    expect(screen.getByText('Algorithms & Data Structures')).toBeInTheDocument();
    expect(screen.getByText('algorithms')).toBeInTheDocument();
  });

  it('shows duration for a VIDEO/RECORDING resource', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    renderAt('res-021');

    expect(
      await screen.findByRole('heading', { name: 'Lecture: Linear Regression' }),
    ).toBeInTheDocument();
    expect(screen.getByText('47m')).toBeInTheDocument();
  });

  it('shows an "Open original resource" link only when a safe source URL exists', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    renderAt('res-012');

    const link = await screen.findByRole('link', { name: 'Open original resource' });
    expect(link).toHaveAttribute('href', 'https://example.edu/articles/postgres-indexing');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('does not show an "Open original resource" link when there is no source URL', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    renderAt('res-001');

    await screen.findByRole('heading', { name: 'Introduction to Algorithms' });
    expect(screen.queryByRole('link', { name: 'Open original resource' })).not.toBeInTheDocument();
  });

  it('shows a restricted-visibility note that does not reveal raw group identifiers', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    renderAt('res-040');

    await screen.findByRole('heading', {
      name: 'Dataset: Open Course Enrollment Records (Anonymized)',
    });
    expect(screen.getByText(/members of specific groups/)).toBeInTheDocument();
    expect(screen.queryByText(/LECTURER/)).not.toBeInTheDocument();
  });

  it('shows a helpful not-found state for an unknown resource id, with a way back', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    const user = userEvent.setup();
    renderAt('does-not-exist');

    expect(await screen.findByText('Resource not found')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to Explore Library' }));

    expect(await screen.findByText('Library stub')).toBeInTheDocument();
  });

  it('shows an error state with a working retry action', async () => {
    server.use(
      meHandler(null),
      resourceDetailHandler,
      bookmarkStatusHandler(),
      bookCopiesHandler(),
    );
    const user = userEvent.setup();
    // `shouldRetryTransientFailure` retries a plain (non-`ApiError`)
    // failure twice before giving up — three rejections in a row to
    // actually exhaust that budget and reach the error state; the next
    // call (the "Try again" click) falls through to the real,
    // MSW-backed implementation.
    vi.spyOn(resourceRepository, 'getById')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    renderAt('res-001');

    expect(await screen.findByText("Couldn't load this resource")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Introduction to Algorithms' }),
    ).toBeInTheDocument();
  });

  it('shows Edit and Delete only when capabilities.canEdit/canDelete are true (Task 05C.3)', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json(MANAGEABLE_RESOURCE),
      ),
      bookmarkStatusHandler(),
    );
    renderAt(MANAGEABLE_RESOURCE.id);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('deletes the resource after explicit confirmation and navigates back to the library', async () => {
    let deleteCalled = false;
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json(MANAGEABLE_RESOURCE),
      ),
      http.delete(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      bookmarkStatusHandler(),
    );
    const user = userEvent.setup();
    renderAt(MANAGEABLE_RESOURCE.id);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/will be permanently deleted/)).toBeInTheDocument();
    expect(deleteCalled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Delete resource' }));

    expect(await screen.findByText('Resource deleted')).toBeInTheDocument();
    expect(deleteCalled).toBe(true);
    expect(await screen.findByText('Library stub')).toBeInTheDocument();
  });

  it('cancelling the delete dialog never calls the delete endpoint', async () => {
    let deleteCalled = false;
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json(MANAGEABLE_RESOURCE),
      ),
      http.delete(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      bookmarkStatusHandler(),
    );
    const user = userEvent.setup();
    renderAt(MANAGEABLE_RESOURCE.id);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/will be permanently deleted/)).not.toBeInTheDocument();
    expect(deleteCalled).toBe(false);
    expect(screen.getByRole('heading', { name: 'A Manageable Article' })).toBeInTheDocument();
  });

  it('never shows Edit/Delete for a resource the viewer cannot manage', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json({
          ...MANAGEABLE_RESOURCE,
          capabilities: { canEdit: false, canDelete: false },
        }),
      ),
      bookmarkStatusHandler(),
    );
    renderAt(MANAGEABLE_RESOURCE.id);

    await screen.findByRole('heading', { name: 'A Manageable Article' });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  describe('save/unsave (Task 06)', () => {
    it('shows "Save" when the resource is not bookmarked, available to any authenticated viewer', async () => {
      server.use(
        meHandler({ ...MOCK_LECTURER_USER, role: 'STUDENT' }),
        resourceDetailHandler,
        bookmarkStatusHandler(),
        bookCopiesHandler(),
      );
      renderAt('res-001');

      expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('shows "Saved" when the resource is already in the viewer\'s bookmarks', async () => {
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_RESOURCE),
        ),
        bookmarkStatusHandler(true),
      );
      renderAt(MANAGEABLE_RESOURCE.id);

      expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument();
    });

    it('clicking "Save" calls the save endpoint and flips to "Saved" once the status refetches', async () => {
      let saveCalled = false;
      let saved = false;
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_RESOURCE),
        ),
        http.get('/api/v1/bookmarks/:resourceId/status', ({ params }) =>
          HttpResponse.json({ resourceId: params.resourceId, isSaved: saved }),
        ),
        http.post('/api/v1/bookmarks', () => {
          saveCalled = true;
          saved = true;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_RESOURCE.id);

      await user.click(await screen.findByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument();
      expect(saveCalled).toBe(true);
    });

    it('clicking "Saved" calls the unsave endpoint and flips back to "Save"', async () => {
      let unsaveCalled = false;
      let saved = true;
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_RESOURCE),
        ),
        http.get('/api/v1/bookmarks/:resourceId/status', ({ params }) =>
          HttpResponse.json({ resourceId: params.resourceId, isSaved: saved }),
        ),
        http.delete(`/api/v1/bookmarks/${MANAGEABLE_RESOURCE.id}`, () => {
          unsaveCalled = true;
          saved = false;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_RESOURCE.id);

      await user.click(await screen.findByRole('button', { name: 'Saved' }));

      expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(unsaveCalled).toBe(true);
    });

    it('shows an error toast and leaves the toggle unchanged when saving fails', async () => {
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_RESOURCE),
        ),
        bookmarkStatusHandler(),
        http.post('/api/v1/bookmarks', () =>
          apiError(500, { error: { message: 'Internal error', code: 'INTERNAL_SERVER_ERROR' } }),
        ),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_RESOURCE.id);

      await user.click(await screen.findByRole('button', { name: 'Save' }));

      expect(await screen.findByText("Couldn't save resource")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  describe('physical copies (Task 07)', () => {
    it('only renders the Physical Copies section for a BOOK resource', async () => {
      server.use(
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_RESOURCE),
        ),
        bookmarkStatusHandler(),
      );
      renderAt(MANAGEABLE_RESOURCE.id);

      await screen.findByRole('heading', { name: 'A Manageable Article' });
      expect(screen.queryByRole('heading', { name: 'Physical Copies' })).not.toBeInTheDocument();
    });

    it('shows each copy with its status, and no Archive button for a non-ADMIN', async () => {
      server.use(
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_BOOK_RESOURCE),
        ),
        bookmarkStatusHandler(),
        bookCopiesHandler({
          items: [
            bookCopyFor({ id: 'copy-1', inventoryCode: 'INV-1', status: 'AVAILABLE' }),
            bookCopyFor({ id: 'copy-2', inventoryCode: 'INV-2', status: 'ON_LOAN' }),
          ],
        }),
      );
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      expect(await screen.findByText('INV-1')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('INV-2')).toBeInTheDocument();
      expect(screen.getByText('On loan')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    });

    it('disables "Borrow a copy" and shows a no-waitlist note when every copy is checked out', async () => {
      server.use(
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_BOOK_RESOURCE),
        ),
        bookmarkStatusHandler(),
        bookCopiesHandler({
          items: [bookCopyFor({ id: 'copy-1', inventoryCode: 'INV-1', status: 'ON_LOAN' })],
        }),
      );
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      expect(await screen.findByText(/no waitlist yet/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Borrow a copy' })).toBeDisabled();
    });

    it('borrowing a copy shows a success toast', async () => {
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_BOOK_RESOURCE),
        ),
        bookmarkStatusHandler(),
        bookCopiesHandler({
          items: [bookCopyFor({ id: 'copy-1', inventoryCode: 'INV-1', status: 'AVAILABLE' })],
        }),
        borrowResourceHandler(),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      await user.click(await screen.findByRole('button', { name: 'Borrow a copy' }));

      expect(await screen.findByText('Copy borrowed')).toBeInTheDocument();
    });

    it('shows an error toast when borrowing fails (e.g. already has an active loan)', async () => {
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_BOOK_RESOURCE),
        ),
        bookmarkStatusHandler(),
        bookCopiesHandler({
          items: [bookCopyFor({ id: 'copy-1', inventoryCode: 'INV-1', status: 'AVAILABLE' })],
        }),
        http.post('/api/v1/loans', () =>
          apiError(409, {
            error: {
              message: 'You already have an active loan for this resource',
              code: 'CONFLICT',
            },
          }),
        ),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      await user.click(await screen.findByRole('button', { name: 'Borrow a copy' }));

      expect(await screen.findByText("Couldn't borrow a copy")).toBeInTheDocument();
    });

    it('an ADMIN can register a new copy', async () => {
      let registeredCode: string | undefined;
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_ADMIN_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json({
            ...MANAGEABLE_BOOK_RESOURCE,
            capabilities: { canEdit: true, canDelete: true },
          }),
        ),
        bookmarkStatusHandler(),
        bookCopiesHandler({ items: [] }),
        http.post(
          `/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}/copies`,
          async ({ request }) => {
            const body = (await request.json()) as { inventoryCode: string };
            registeredCode = body.inventoryCode;
            return HttpResponse.json(bookCopyFor({ inventoryCode: body.inventoryCode }), {
              status: 201,
            });
          },
        ),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      const input = await screen.findByLabelText('New inventory code');
      await user.type(input, 'INV-NEW-1');
      await user.click(screen.getByRole('button', { name: 'Register copy' }));

      expect(await screen.findByText('Copy registered')).toBeInTheDocument();
      expect(registeredCode).toBe('INV-NEW-1');
    });

    it('an ADMIN can archive an AVAILABLE copy, but not an ON_LOAN one', async () => {
      // A stateful GET, not the static `bookCopiesHandler` — the
      // archive mutation only invalidates-and-refetches (no optimistic
      // update), so the list this test asserts against after clicking
      // must actually reflect the PATCH, the same stateful-handler
      // convention `createStatefulCollectionHandlers` uses in
      // `CollectionDetailsPage.test.tsx` (Task 06).
      const copies = [
        bookCopyFor({ id: 'copy-1', inventoryCode: 'INV-1', status: 'AVAILABLE' }),
        bookCopyFor({ id: 'copy-2', inventoryCode: 'INV-2', status: 'ON_LOAN' }),
      ];
      server.use(
        csrfTokenHandler,
        meHandler(MOCK_ADMIN_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json({
            ...MANAGEABLE_BOOK_RESOURCE,
            capabilities: { canEdit: true, canDelete: true },
          }),
        ),
        bookmarkStatusHandler(),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}/copies`, () =>
          HttpResponse.json({ items: copies }),
        ),
        http.patch(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}/copies/copy-1`, () => {
          const copy = copies.find((item) => item.id === 'copy-1');
          if (copy) copy.status = 'ARCHIVED';
          return HttpResponse.json(copy);
        }),
      );
      const user = userEvent.setup();
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      await screen.findByText('INV-1');
      const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
      expect(archiveButtons).toHaveLength(2);
      expect(archiveButtons[1]).toBeDisabled();

      await user.click(archiveButtons[0] as HTMLElement);
      expect(await screen.findByText('Archived')).toBeInTheDocument();
    });

    it('registering a copy is not offered to a non-ADMIN', async () => {
      server.use(
        meHandler(MOCK_LECTURER_USER),
        http.get(`/api/v1/resources/${MANAGEABLE_BOOK_RESOURCE.id}`, () =>
          HttpResponse.json(MANAGEABLE_BOOK_RESOURCE),
        ),
        bookmarkStatusHandler(),
        bookCopiesHandler({
          items: [bookCopyFor({ id: 'copy-1', inventoryCode: 'INV-1', status: 'AVAILABLE' })],
        }),
      );
      renderAt(MANAGEABLE_BOOK_RESOURCE.id);

      await screen.findByText('INV-1');
      expect(screen.queryByLabelText('New inventory code')).not.toBeInTheDocument();
    });
  });
});
