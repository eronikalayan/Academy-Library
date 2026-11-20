import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { CollectionDetail } from '@academy-library/contracts';
import { server } from '../../test/mswServer';
import { apiError, csrfTokenHandler, groupsHandler, meHandler } from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { EditCollectionPage } from './EditCollectionPage';

const BASE_COLLECTION: CollectionDetail = {
  id: 'col-1',
  title: 'Existing Collection',
  description: 'Already exists.',
  coverImageUrl: null,
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
  capabilities: { canEdit: true, canDelete: true },
  resources: [],
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
};

function detailHandler(detail: CollectionDetail) {
  return http.get(`/api/v1/collections/${detail.id}`, () => HttpResponse.json(detail));
}

function renderEditPage() {
  return renderWithDataRouter(
    [
      { path: '/collections/:collectionId/edit', element: <EditCollectionPage /> },
      { path: '/collections/:collectionId', element: <p>Collection detail stub</p> },
    ],
    { route: `/collections/${BASE_COLLECTION.id}/edit` },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditCollectionPage', () => {
  it('shows a not-found state for an unknown collection id', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/collections/${BASE_COLLECTION.id}`, () =>
        apiError(404, { error: { message: 'Collection not found', code: 'NOT_FOUND' } }),
      ),
    );
    renderEditPage();

    expect(await screen.findByText('Collection not found')).toBeInTheDocument();
  });

  it('shows an inline access-denied message when capabilities.canEdit is false, not a redirect', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      detailHandler({ ...BASE_COLLECTION, capabilities: { canEdit: false, canDelete: false } }),
    );
    renderEditPage();

    expect(
      await screen.findByText("You don't have access to edit this collection"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });

  it('prepopulates the form and saves only the changed field as a PATCH', async () => {
    let capturedBody: unknown;
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      groupsHandler([]),
      detailHandler(BASE_COLLECTION),
      http.patch(`/api/v1/collections/${BASE_COLLECTION.id}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...BASE_COLLECTION, title: 'Updated Title' });
      }),
    );
    const user = userEvent.setup();
    renderEditPage();

    const titleInput = await screen.findByLabelText(/^Title/);
    expect(titleInput).toHaveValue('Existing Collection');

    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Collection updated')).toBeInTheDocument();
    expect(capturedBody).toEqual({ title: 'Updated Title' });
    expect(await screen.findByText('Collection detail stub')).toBeInTheDocument();
  });

  it('disables the submit button until a field actually changes', async () => {
    server.use(meHandler(MOCK_LECTURER_USER), groupsHandler([]), detailHandler(BASE_COLLECTION));
    renderEditPage();

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
});
