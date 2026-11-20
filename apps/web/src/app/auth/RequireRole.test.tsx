import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { MOCK_ADMIN_USER, MOCK_STUDENT_USER } from '../../test/authFixtures';
import { csrfTokenHandler, meHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { RequireRole } from './RequireRole';

function renderAdminRoute() {
  return renderWithProviders(
    <Routes>
      <Route element={<RequireRole roles={['ADMIN']} />}>
        <Route element={<Outlet />}>
          <Route path="/admin" element={<div>Admin dashboard</div>} />
        </Route>
      </Route>
    </Routes>,
    { route: '/admin' },
  );
}

describe('RequireRole', () => {
  it('renders the admin content for an ADMIN user', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_ADMIN_USER));
    renderAdminRoute();

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
  });

  it('shows a 403 message (not the admin content, not a redirect) for a non-admin user', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderAdminRoute();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  it('shows a loading state before the role check resolves', () => {
    server.use(csrfTokenHandler, meHandler(MOCK_ADMIN_USER));
    renderAdminRoute();

    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
