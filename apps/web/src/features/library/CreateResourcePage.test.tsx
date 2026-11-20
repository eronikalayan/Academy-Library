import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../test/mswServer';
import {
  apiError,
  coursesHandler,
  csrfTokenHandler,
  groupsHandler,
  meHandler,
  resourceCreateHandler,
} from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { CreateResourcePage } from './CreateResourcePage';

// `CreateResourcePage` renders `ResourceForm`, which calls `useBlocker`
// (Task 05D) — needs a real data router, not the classic
// `renderWithProviders`/`<MemoryRouter>` (see that helper's doc comment).
function renderCreatePage() {
  return renderWithDataRouter(
    [
      { path: '/library/new', element: <CreateResourcePage /> },
      { path: '/library/:resourceId', element: <p>Resource detail stub</p> },
    ],
    { route: '/library/new' },
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Title/), 'A New Article');
  await user.type(screen.getByLabelText(/^Description/), 'Describes something useful.');
  await user.type(screen.getByLabelText(/^Creator name/), 'Jane Doe');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateResourcePage', () => {
  it('creates a resource, shows a success toast, and navigates to its detail page', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      coursesHandler([]),
      groupsHandler([]),
      resourceCreateHandler,
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Resource created')).toBeInTheDocument();
    expect(await screen.findByText('Resource detail stub')).toBeInTheDocument();
  });

  it('does not show the unsaved-changes dialog on the post-success navigate (Task 05D)', async () => {
    // The form is dirty right up until the moment of submission — this
    // confirms the navigate({ replace: true }) in CreateResourcePage's
    // own onSuccess handler is exempt from useUnsavedChangesBlocker
    // rather than getting caught by it.
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      coursesHandler([]),
      groupsHandler([]),
      resourceCreateHandler,
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Resource detail stub')).toBeInTheDocument();
    expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
  });

  it('shows a server error and keeps the form in place when creation fails', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      coursesHandler([]),
      groupsHandler([]),
      http.post('/api/v1/resources', () =>
        apiError(500, { error: { message: 'Internal error', code: 'INTERNAL_SERVER_ERROR' } }),
      ),
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Resource detail stub')).not.toBeInTheDocument());
  });
});
