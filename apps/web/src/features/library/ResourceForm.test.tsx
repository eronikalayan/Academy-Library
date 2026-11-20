import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResourceCreateInput } from '@academy-library/contracts';
import { Link } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { coursesHandler, groupsHandler, meHandler } from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithDataRouter } from '../../test/renderWithProviders';
import { ResourceForm } from './ResourceForm';

const COURSES = [
  { id: 'course-algo', title: 'Algorithms & Data Structures' },
  { id: 'course-cs101', title: 'Introduction to Computer Science' },
];
const GROUPS = [{ id: 'group-honors', name: 'Honors Cohort' }];

// `ResourceForm` calls `useBlocker` (Task 05D's unsaved-changes guard),
// which requires a real data router — `renderWithDataRouter`, not the
// classic `renderWithProviders`/`<MemoryRouter>`, for every render in
// this file (see that helper's own doc comment).
function renderCreateForm(onSubmit = vi.fn<(input: ResourceCreateInput) => void>()) {
  server.use(meHandler(MOCK_LECTURER_USER), coursesHandler(COURSES), groupsHandler(GROUPS));
  renderWithDataRouter([
    {
      path: '/',
      element: <ResourceForm mode="create" onSubmit={onSubmit} isSubmitting={false} />,
    },
  ]);
  return onSubmit;
}

/** Renders the create form alongside a plain in-app link, so navigation
 * tests can trigger a `PUSH` away from the form without going through
 * either page's own submit-success `navigate(..., { replace: true })`. */
function renderCreateFormWithNavLink(onSubmit = vi.fn<(input: ResourceCreateInput) => void>()) {
  server.use(meHandler(MOCK_LECTURER_USER), coursesHandler(COURSES), groupsHandler(GROUPS));
  renderWithDataRouter(
    [
      {
        path: '/form',
        element: (
          <>
            <Link to="/elsewhere">Go elsewhere</Link>
            <ResourceForm mode="create" onSubmit={onSubmit} isSubmitting={false} />
          </>
        ),
      },
      { path: '/elsewhere', element: <p>Elsewhere page</p> },
    ],
    { route: '/form' },
  );
  return onSubmit;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResourceForm', () => {
  it('shows validation errors for required fields and does not call onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreateForm();

    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Creator name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the duration field only for VIDEO/RECORDING, and requires it', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.queryByLabelText(/Duration \(minutes\)/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Resource type/), 'VIDEO');
    expect(await screen.findByLabelText(/Duration \(minutes\)/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Resource type/), 'ARTICLE');
    await waitFor(() => {
      expect(screen.queryByLabelText(/Duration \(minutes\)/)).not.toBeInTheDocument();
    });
  });

  it('shows the restricted-group picker only when visibility is RESTRICTED', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.queryByText('Restricted to')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Restricted — only specific groups'));
    expect(await screen.findByText('Restricted to')).toBeInTheDocument();
    expect(await screen.findByLabelText('Honors Cohort')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Public — visible to everyone'));
    await waitFor(() => {
      expect(screen.queryByText('Restricted to')).not.toBeInTheDocument();
    });
  });

  it('adds and removes tags via the tag input', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    const tagInput = screen.getByLabelText('Tags');
    await user.type(tagInput, 'machine-learning{enter}');
    expect(screen.getByText('machine-learning')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove tag machine-learning' }));
    expect(screen.queryByText('machine-learning')).not.toBeInTheDocument();
  });

  it('submits a complete, valid create payload', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreateForm();

    // `required` fields render a trailing, `aria-hidden` "*" marker
    // inside the <label> that's still part of its plain-text content —
    // an exact string match against just "Title" would miss it (see
    // docs/architecture/decisions.md, Task 05C.1's RTL query gotcha).
    await user.type(screen.getByLabelText(/^Title/), 'A New Article');
    await user.type(screen.getByLabelText(/^Description/), 'Describes something useful.');
    await user.type(screen.getByLabelText(/^Creator name/), 'Jane Doe');
    await user.click(await screen.findByLabelText('Algorithms & Data Structures'));

    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const call = onSubmit.mock.calls[0];
    if (!call) throw new Error('Expected onSubmit to have been called with a payload');
    const [submitted] = call;
    expect(submitted.title).toBe('A New Article');
    expect(submitted.courseIds).toEqual(['course-algo']);
    expect(submitted.visibility).toBe('PUBLIC');
  });

  it('disables the submit button in edit mode until a field actually changes', async () => {
    server.use(meHandler(MOCK_LECTURER_USER), coursesHandler(COURSES), groupsHandler(GROUPS));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithDataRouter([
      {
        path: '/',
        element: (
          <ResourceForm
            mode="edit"
            onSubmit={onSubmit}
            isSubmitting={false}
            initialResource={{
              id: 'res-1',
              type: 'ARTICLE',
              title: 'Existing',
              description: 'Already here.',
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
            }}
          />
        ),
      },
    ]);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.type(screen.getByLabelText(/^Title/), '!');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  describe('unsaved-changes navigation guard (Task 05D)', () => {
    it('does not block in-app navigation while the form is untouched', async () => {
      const user = userEvent.setup();
      renderCreateFormWithNavLink();

      await user.click(screen.getByRole('link', { name: 'Go elsewhere' }));

      expect(await screen.findByText('Elsewhere page')).toBeInTheDocument();
    });

    it('blocks in-app navigation away from a dirty form, and "Keep editing" stays on the form', async () => {
      const user = userEvent.setup();
      renderCreateFormWithNavLink();

      await user.type(screen.getByLabelText(/^Title/), 'Unsaved title');
      await user.click(screen.getByRole('link', { name: 'Go elsewhere' }));

      expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
      expect(screen.queryByText('Elsewhere page')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Title/)).toHaveValue('Unsaved title');
    });

    it('navigates away once the user confirms leaving without saving', async () => {
      const user = userEvent.setup();
      renderCreateFormWithNavLink();

      await user.type(screen.getByLabelText(/^Title/), 'Unsaved title');
      await user.click(screen.getByRole('link', { name: 'Go elsewhere' }));
      await screen.findByText('Leave without saving?');

      await user.click(screen.getByRole('button', { name: 'Leave without saving' }));

      expect(await screen.findByText('Elsewhere page')).toBeInTheDocument();
    });
  });
});
