import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CollectionDetail, ResourceSummary } from '@academy-library/contracts';
import { server } from '../../test/mswServer';
import {
  collectionDetailHandler,
  createStatefulCollectionHandlers,
  csrfTokenHandler,
  meHandler,
  resourceListHandler,
} from '../../test/mswHandlers';
import { MOCK_ADMIN_USER, MOCK_LECTURER_USER, MOCK_STUDENT_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { CollectionDetailsPage } from './CollectionDetailsPage';

function resourceSummary(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
  return {
    id: 'res-1',
    title: 'Introduction to Algorithms',
    description: 'A thorough grounding in algorithmic thinking.',
    type: 'BOOK',
    difficulty: 'BEGINNER',
    creator: { name: 'R. Kesari' },
    coverImageUrl: null,
    courses: [],
    tags: [],
    durationSeconds: null,
    visibility: 'PUBLIC',
    publishedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseCollection(overrides: Partial<CollectionDetail> = {}): CollectionDetail {
  return {
    id: 'col-1',
    title: 'Algorithms Study Materials',
    description: 'A curated path through algorithmic thinking.',
    coverImageUrl: null,
    visibility: 'PUBLIC',
    restrictedToGroupIds: [],
    capabilities: { canEdit: false, canDelete: false },
    resources: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderAt(collectionId: string) {
  return renderWithDataRouter(
    [
      { path: '/collections/:collectionId', element: <CollectionDetailsPage /> },
      { path: '/collections', element: <p>Collections stub</p> },
    ],
    { route: `/collections/${collectionId}` },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CollectionDetailsPage', () => {
  it('404s render a not-found state with a way back', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), collectionDetailHandler(null));
    const user = userEvent.setup();
    renderAt('unknown');

    expect(await screen.findByText('Collection not found')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to Collections' }));
    expect(await screen.findByText('Collections stub')).toBeInTheDocument();
  });

  it('renders the resource list the backend already returned, in order', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      collectionDetailHandler(
        baseCollection({
          resources: [
            { resource: resourceSummary({ id: 'res-1', title: 'First' }), position: 0 },
            { resource: resourceSummary({ id: 'res-2', title: 'Second' }), position: 1 },
          ],
        }),
      ),
    );
    renderAt('col-1');

    await screen.findByRole('heading', { name: 'Algorithms Study Materials' });
    const titles = screen.getAllByText(/^(First|Second)$/).map((el) => el.textContent);
    expect(titles).toEqual(['First', 'Second']);
  });

  it('never shows Edit/Delete or reorder/remove controls for a viewer without capabilities', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      collectionDetailHandler(
        baseCollection({
          capabilities: { canEdit: false, canDelete: false },
          resources: [{ resource: resourceSummary(), position: 0 }],
        }),
      ),
    );
    renderAt('col-1');

    await screen.findByRole('heading', { name: 'Algorithms Study Materials' });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Move .* up/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Add a resource')).not.toBeInTheDocument();
  });

  it('shows Edit/Delete and the add-resource panel for the owning LECTURER', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      collectionDetailHandler(baseCollection({ capabilities: { canEdit: true, canDelete: true } })),
      resourceListHandler,
    );
    renderAt('col-1');

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByText('Add a resource')).toBeInTheDocument();
  });

  it('an ADMIN always has full capabilities, even on someone else’s collection', async () => {
    server.use(
      meHandler(MOCK_ADMIN_USER),
      collectionDetailHandler(baseCollection({ capabilities: { canEdit: true, canDelete: true } })),
      resourceListHandler,
    );
    renderAt('col-1');

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('adding a resource via the search panel calls the add endpoint and shows it in the list', async () => {
    const handlers = createStatefulCollectionHandlers(
      baseCollection({ capabilities: { canEdit: true, canDelete: true } }),
    );
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      handlers.get,
      handlers.addResource,
      resourceListHandler,
    );
    const user = userEvent.setup();
    renderAt('col-1');

    await screen.findByText('Add a resource');
    expect(screen.getByRole('heading', { name: 'Resources (0)' })).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'Search resources to add' }),
      'Introduction to Algorithms',
    );

    const addButton = await screen.findByRole('button', { name: 'Add' });
    await user.click(addButton);

    // Once the add succeeds and the collection refetches, the just-added
    // resource both (a) shows up in the resource count heading and (b)
    // disappears from its own search results (it's now a member, not a
    // candidate) — asserting on the count is unambiguous either way.
    expect(await screen.findByRole('heading', { name: 'Resources (1)' })).toBeInTheDocument();
  });

  it('removing a resource calls the remove endpoint and takes it out of the list', async () => {
    const handlers = createStatefulCollectionHandlers(
      baseCollection({
        capabilities: { canEdit: true, canDelete: true },
        resources: [{ resource: resourceSummary({ title: 'Removable' }), position: 0 }],
      }),
    );
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      handlers.get,
      handlers.removeResource,
      resourceListHandler,
    );
    const user = userEvent.setup();
    renderAt('col-1');

    await screen.findByText('Removable');
    await user.click(screen.getByRole('button', { name: /Remove "Removable"/ }));

    await waitFor(() => expect(screen.queryByText('Removable')).not.toBeInTheDocument());
  });

  it('moving a resource down calls the reorder endpoint with the full new order', async () => {
    const handlers = createStatefulCollectionHandlers(
      baseCollection({
        capabilities: { canEdit: true, canDelete: true },
        resources: [
          { resource: resourceSummary({ id: 'res-1', title: 'First' }), position: 0 },
          { resource: resourceSummary({ id: 'res-2', title: 'Second' }), position: 1 },
        ],
      }),
    );
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      handlers.get,
      handlers.reorder,
      resourceListHandler,
    );
    const user = userEvent.setup();
    renderAt('col-1');

    await screen.findByText('First');
    await user.click(screen.getByRole('button', { name: 'Move "First" down' }));

    await waitFor(() => {
      const titles = screen.getAllByText(/^(First|Second)$/).map((el) => el.textContent);
      expect(titles).toEqual(['Second', 'First']);
    });
  });

  it('the Up control is disabled on the first item and Down is disabled on the last', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      collectionDetailHandler(
        baseCollection({
          capabilities: { canEdit: true, canDelete: true },
          resources: [
            { resource: resourceSummary({ id: 'res-1', title: 'First' }), position: 0 },
            { resource: resourceSummary({ id: 'res-2', title: 'Second' }), position: 1 },
          ],
        }),
      ),
      resourceListHandler,
    );
    renderAt('col-1');

    await screen.findByText('First');
    expect(screen.getByRole('button', { name: 'Move "First" up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move "Second" down' })).toBeDisabled();
  });
});
