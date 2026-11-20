import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../test/mswServer';
import {
  apiError,
  collectionCreateHandler,
  csrfTokenHandler,
  groupsHandler,
  meHandler,
} from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { CreateCollectionPage } from './CreateCollectionPage';

function renderCreatePage() {
  return renderWithDataRouter(
    [
      { path: '/collections/new', element: <CreateCollectionPage /> },
      { path: '/collections/:collectionId', element: <p>Collection detail stub</p> },
    ],
    { route: '/collections/new' },
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Title/), 'A New Collection');
  await user.type(screen.getByLabelText(/^Description/), 'Describes something useful.');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateCollectionPage', () => {
  it('creates a collection, shows a success toast, and navigates to its detail page', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      groupsHandler([]),
      collectionCreateHandler,
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(await screen.findByText('Collection created')).toBeInTheDocument();
    expect(await screen.findByText('Collection detail stub')).toBeInTheDocument();
  });

  it('shows a server error and keeps the form in place when creation fails', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      groupsHandler([]),
      http.post('/api/v1/collections', () =>
        apiError(500, { error: { message: 'Internal error', code: 'INTERNAL_SERVER_ERROR' } }),
      ),
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Collection detail stub')).not.toBeInTheDocument();
  });

  it('requires title and description before submitting', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_LECTURER_USER), groupsHandler([]));
    const user = userEvent.setup();
    renderCreatePage();

    await user.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
  });

  it('requires at least one group when visibility is Restricted', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      groupsHandler([{ id: 'group-1', name: 'Honors Cohort' }]),
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText('Restricted — only specific groups'));
    await user.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(
      await screen.findByText('Select at least one group this collection is restricted to.'),
    ).toBeInTheDocument();
  });
});
