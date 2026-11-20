import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { csrfTokenHandler, meHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { RedirectIfAuthenticated } from './RedirectIfAuthenticated';

function renderAuthPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<div>Dashboard page</div>} />
      <Route path="/library/:id" element={<div>Resource detail page</div>} />
      <Route element={<RedirectIfAuthenticated />}>
        <Route element={<Outlet />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
      </Route>
    </Routes>,
    { route },
  );
}

describe('RedirectIfAuthenticated', () => {
  it('renders the login form for an anonymous visitor', async () => {
    server.use(csrfTokenHandler, meHandler(null));
    renderAuthPage('/login');

    expect(await screen.findByText('Login form')).toBeInTheDocument();
  });

  it('redirects an already-authenticated visitor to /dashboard by default', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderAuthPage('/login');

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('redirects an authenticated visitor to a safe ?from= destination instead, when present', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderAuthPage('/login?from=%2Flibrary%2Fabc');

    expect(await screen.findByText('Resource detail page')).toBeInTheDocument();
  });

  it('does not redirect to /login itself even if ?from=/login is crafted (no redirect loop)', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderAuthPage('/login?from=%2Flogin');

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });
});
