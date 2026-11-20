import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CollectionSummary } from '@academy-library/contracts';
import { server } from '../../test/mswServer';
import { collectionListHandler, meHandler } from '../../test/mswHandlers';
import { MOCK_ADMIN_USER, MOCK_LECTURER_USER, MOCK_STUDENT_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { CollectionsPage } from './CollectionsPage';

function collection(overrides: Partial<CollectionSummary> = {}): CollectionSummary {
  return {
    id: 'col-1',
    title: 'Algorithms Study Materials',
    description: 'A curated path through algorithmic thinking.',
    coverImageUrl: null,
    visibility: 'PUBLIC',
    resourceCount: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return renderWithDataRouter([{ path: '/', element: <CollectionsPage /> }]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CollectionsPage', () => {
  it('shows a "Create collection" action for a LECTURER, not for a STUDENT', async () => {
    server.use(meHandler(MOCK_LECTURER_USER), collectionListHandler());
    renderPage();
    expect(await screen.findByRole('button', { name: 'Create collection' })).toBeInTheDocument();
  });

  it('never shows "Create collection" for a STUDENT (display-only gate, matches LibraryPage’s convention)', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), collectionListHandler());
    renderPage();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Create collection' })).not.toBeInTheDocument();
  });

  it('shows "Create collection" for an ADMIN too', async () => {
    server.use(meHandler(MOCK_ADMIN_USER), collectionListHandler());
    renderPage();
    expect(await screen.findByRole('button', { name: 'Create collection' })).toBeInTheDocument();
  });

  it('renders each collection card with its title and viewer-visible resource count', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      collectionListHandler({
        items: [
          collection({ resourceCount: 2 }),
          collection({
            id: 'col-2',
            title: 'Databases',
            visibility: 'RESTRICTED',
            resourceCount: 0,
          }),
        ],
        page: 1,
        pageSize: 12,
        totalItems: 2,
        totalPages: 1,
      }),
    );
    renderPage();

    expect(await screen.findByText('Algorithms Study Materials')).toBeInTheDocument();
    expect(screen.getByText('2 resources')).toBeInTheDocument();
    expect(screen.getByText('Databases')).toBeInTheDocument();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
  });

  it('shows an empty state with no collections and no active search', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), collectionListHandler());
    renderPage();

    expect(await screen.findByText("You haven't created any collections yet")).toBeInTheDocument();
  });

  it('filters by search term (debounced)', async () => {
    const user = userEvent.setup();
    server.use(
      meHandler(MOCK_STUDENT_USER),
      collectionListHandler({
        items: [collection()],
        page: 1,
        pageSize: 12,
        totalItems: 1,
        totalPages: 1,
      }),
    );
    renderPage();
    await screen.findByText('Algorithms Study Materials');

    server.use(
      meHandler(MOCK_STUDENT_USER),
      collectionListHandler({ items: [], page: 1, pageSize: 12, totalItems: 0, totalPages: 1 }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Search collections' }), 'nothing matches');

    expect(await screen.findByText('No collections match your search')).toBeInTheDocument();
  });
});
