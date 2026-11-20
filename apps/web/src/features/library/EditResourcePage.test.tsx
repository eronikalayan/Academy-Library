import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ResourceDetail } from '@academy-library/contracts';
import { server } from '../../test/mswServer';
import {
  apiError,
  coursesHandler,
  csrfTokenHandler,
  groupsHandler,
  meHandler,
} from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { EditResourcePage } from './EditResourcePage';

const BASE_RESOURCE: ResourceDetail = {
  id: 'res-1',
  type: 'ARTICLE',
  title: 'Existing Article',
  description: 'Already exists.',
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

function detailHandler(resource: ResourceDetail) {
  return http.get(`/api/v1/resources/${resource.id}`, () => HttpResponse.json(resource));
}

// `EditResourcePage` renders `ResourceForm`, which calls `useBlocker`
// (Task 05D) — needs a real data router, not the classic
// `renderWithProviders`/`<MemoryRouter>` (see that helper's doc comment).
function renderEditPage() {
  return renderWithDataRouter(
    [
      { path: '/library/:resourceId/edit', element: <EditResourcePage /> },
      { path: '/library/:resourceId', element: <p>Resource detail stub</p> },
    ],
    { route: `/library/${BASE_RESOURCE.id}/edit` },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditResourcePage', () => {
  it('shows a not-found state for an unknown resource id', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${BASE_RESOURCE.id}`, () =>
        apiError(404, { error: { message: 'Resource not found', code: 'NOT_FOUND' } }),
      ),
    );
    renderEditPage();

    expect(await screen.findByText('Resource not found')).toBeInTheDocument();
  });

  it('shows an inline access-denied message when capabilities.canEdit is false, not a redirect', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      detailHandler({ ...BASE_RESOURCE, capabilities: { canEdit: false, canDelete: false } }),
    );
    renderEditPage();

    expect(
      await screen.findByText("You don't have access to edit this resource"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });

  it('prepopulates the form and saves only the changed field as a PATCH', async () => {
    let capturedBody: unknown;
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      coursesHandler([]),
      groupsHandler([]),
      detailHandler(BASE_RESOURCE),
      http.patch(`/api/v1/resources/${BASE_RESOURCE.id}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...BASE_RESOURCE, title: 'Updated Title' });
      }),
    );
    const user = userEvent.setup();
    renderEditPage();

    const titleInput = await screen.findByLabelText(/^Title/);
    expect(titleInput).toHaveValue('Existing Article');

    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Resource updated')).toBeInTheDocument();
    expect(capturedBody).toEqual({ title: 'Updated Title' });
    expect(await screen.findByText('Resource detail stub')).toBeInTheDocument();
  });
});
