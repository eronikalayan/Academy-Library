import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import { mockResourceRepository, resourceRepository } from '../../shared/data/resources';
import { server } from '../../test/mswServer';
import { meHandler, resourceListHandler } from '../../test/mswHandlers';
import { createTestQueryClient, renderWithProviders } from '../../test/renderWithProviders';
import { MOCK_ADMIN_USER, MOCK_LECTURER_USER, MOCK_STUDENT_USER } from '../../test/authFixtures';
import { AUTH_ME_QUERY_KEY } from '../auth/api/useCurrentUser';
import { LibraryPage } from './LibraryPage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LibraryPage', () => {
  it('shows a loading state, then the full catalogue with a resource count', async () => {
    server.use(meHandler(null), resourceListHandler);
    renderWithProviders(<LibraryPage />, { route: '/library' });

    expect(screen.getByRole('status', { name: 'Loading resources' })).toBeInTheDocument();

    expect(
      await screen.findByText('Showing 1–12 of 40 resources', undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(12);
  });

  it('filters results as the user types in the search field (debounced)', async () => {
    server.use(meHandler(null), resourceListHandler);
    const user = userEvent.setup();
    renderWithProviders(<LibraryPage />, { route: '/library' });
    await screen.findByText(/Showing 1–12 of 40 resources/);

    await user.type(screen.getByLabelText('Search the library'), 'postgres');

    expect(
      await screen.findByText('Showing 1–2 of 2 resources', undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Indexing Strategies for Large Postgres Tables')).toBeInTheDocument();
  });

  it('shows a "no results" empty state with a clear action when a search matches nothing', async () => {
    server.use(meHandler(null), resourceListHandler);
    const user = userEvent.setup();
    renderWithProviders(<LibraryPage />, { route: '/library' });
    await screen.findByText(/Showing 1–12 of 40 resources/);

    await user.type(screen.getByLabelText('Search the library'), 'zzzznoresults');

    expect(
      await screen.findByText('No resources match your search', undefined, { timeout: 2000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search & filters' }));

    expect(
      await screen.findByText(/Showing 1–12 of 40 resources/, undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('shows the "empty library" state (not the search-specific one) when there is no active query', async () => {
    server.use(meHandler(null));
    vi.spyOn(resourceRepository, 'list').mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 1,
    });

    renderWithProviders(<LibraryPage />, { route: '/library' });

    expect(await screen.findByText('The library is empty')).toBeInTheDocument();
  });

  it('applies a resource-type filter from the Filters panel', async () => {
    server.use(meHandler(null), resourceListHandler);
    const user = userEvent.setup();
    renderWithProviders(<LibraryPage />, { route: '/library' });
    await screen.findByText(/Showing 1–12 of 40 resources/);

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Resource type'), 'RECORDING');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(screen.getByText(/Showing 1–4 of 4 resources/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeInTheDocument();
  });

  it('navigates to pages 2 of the catalogue via Pagination', async () => {
    server.use(meHandler(null), resourceListHandler);
    const user = userEvent.setup();
    renderWithProviders(<LibraryPage />, { route: '/library' });
    await screen.findByText(/Showing 1–12 of 40 resources/);

    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(await screen.findByText(/Showing 13–24 of 40 resources/)).toBeInTheDocument();
  });

  it('switches between grid and list view without losing the result set', async () => {
    server.use(meHandler(null), resourceListHandler);
    const user = userEvent.setup();
    renderWithProviders(<LibraryPage />, { route: '/library' });
    await screen.findByText(/Showing 1–12 of 40 resources/);

    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Showing 1–12 of 40 resources/)).toBeInTheDocument();
  });

  it('links each resource card to its detail route', async () => {
    server.use(meHandler(null), resourceListHandler);
    renderWithProviders(
      <Routes>
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/:resourceId" element={<p>Resource detail stub</p>} />
      </Routes>,
      { route: '/library' },
    );
    await screen.findByText(/Showing 1–12 of 40 resources/);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/library\/res-\d+$/));
  });

  it('shows an error state with a working retry action', async () => {
    server.use(meHandler(null), resourceListHandler);
    const user = userEvent.setup();
    // `shouldRetryTransientFailure` retries a plain (non-`ApiError`)
    // failure twice before giving up — three rejections in a row to
    // actually exhaust that budget and reach the error state; the next
    // call (the "Try again" click) falls through to the real,
    // MSW-backed implementation.
    vi.spyOn(resourceRepository, 'list')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    renderWithProviders(<LibraryPage />, { route: '/library' });

    expect(await screen.findByText("Couldn't load the library")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/Showing 1–12 of 40 resources/)).toBeInTheDocument();
  });

  it('shows no trace of the previous user’s resources after switching accounts in the same session', async () => {
    server.use(meHandler(MOCK_STUDENT_USER));
    // Two real fixture summaries (not hand-built objects) stand in for
    // what two different identities would each uniquely see — the mock
    // repository itself doesn't filter by caller (that's the real
    // backend's job, covered by the Playwright E2E suite instead), so
    // this exercises the thing a unit test *can* verify: switching the
    // signed-in identity produces a brand-new query, and the previous
    // identity's rendered content is fully gone, not just stale-but-
    // present underneath the new data.
    const { items: studentItems } = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: 'Introduction to Algorithms' }),
    );
    const { items: adminItems } = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: 'Dataset: Open Course Enrollment Records' }),
    );
    vi.spyOn(resourceRepository, 'list')
      .mockResolvedValueOnce({
        items: studentItems,
        page: 1,
        pageSize: 12,
        totalItems: studentItems.length,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        items: adminItems,
        page: 1,
        pageSize: 12,
        totalItems: adminItems.length,
        totalPages: 1,
      });

    const queryClient = createTestQueryClient();
    renderWithProviders(<LibraryPage />, { route: '/library', queryClient });

    expect(await screen.findByText('Introduction to Algorithms')).toBeInTheDocument();

    // Mirrors `useLoginMutation`'s own direct write to this cache key
    // (see `useCurrentUser.ts`) — a student logging out and a different
    // admin logging back in within the same browser tab.
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_ADMIN_USER);

    expect(
      await screen.findByText('Dataset: Open Course Enrollment Records (Anonymized)'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Introduction to Algorithms')).not.toBeInTheDocument();
  });

  it('never shows "Create resource" for a STUDENT (Task 05C.3)', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), resourceListHandler);
    renderWithProviders(<LibraryPage />, { route: '/library' });
    await screen.findByText(/Showing 1–\d+ of \d+ resources/);
    expect(screen.queryByRole('button', { name: 'Create resource' })).not.toBeInTheDocument();
  });

  it('shows "Create resource" for a LECTURER (Task 05C.3)', async () => {
    server.use(meHandler(MOCK_LECTURER_USER), resourceListHandler);
    renderWithProviders(<LibraryPage />, { route: '/library' });
    expect(await screen.findByRole('button', { name: 'Create resource' })).toBeInTheDocument();
  });
});
