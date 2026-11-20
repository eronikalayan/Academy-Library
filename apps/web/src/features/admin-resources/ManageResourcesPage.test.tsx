import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mswServer';
import { csrfTokenHandler, meHandler, resourceListHandler } from '../../test/mswHandlers';
import { MOCK_ADMIN_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ManageResourcesPage } from './ManageResourcesPage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/resources" element={<ManageResourcesPage />} />
      <Route path="/library/new" element={<p>Create resource stub</p>} />
      <Route path="/library/:resourceId/edit" element={<p>Edit resource stub</p>} />
    </Routes>,
    { route: '/admin/resources' },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ManageResourcesPage', () => {
  it('lists real resources with an Edit/Delete action per row for an ADMIN', async () => {
    server.use(meHandler(MOCK_ADMIN_USER), resourceListHandler);
    renderPage();

    expect((await screen.findAllByRole('button', { name: 'Edit' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThan(0);
  });

  it('navigating "Add resource" goes to the real create page route', async () => {
    server.use(meHandler(MOCK_ADMIN_USER), resourceListHandler);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('button', { name: 'Edit' });

    await user.click(screen.getByRole('button', { name: 'Add resource' }));
    expect(await screen.findByText('Create resource stub')).toBeInTheDocument();
  });

  it('deletes a resource from the list after confirming', async () => {
    let deleteCalled = false;
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_ADMIN_USER),
      resourceListHandler,
      http.delete('/api/v1/resources/:id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('button', { name: 'Edit' });

    const [firstDeleteButton] = screen.getAllByRole('button', { name: 'Delete' });
    if (!firstDeleteButton) throw new Error('Expected at least one Delete button to be rendered');
    await user.click(firstDeleteButton);
    await user.click(screen.getByRole('button', { name: 'Delete resource' }));

    expect(await screen.findByText('Resource deleted')).toBeInTheDocument();
    expect(deleteCalled).toBe(true);
  });
});
