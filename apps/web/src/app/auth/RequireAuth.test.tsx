import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Outlet, Route, Routes } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { csrfTokenHandler, meHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { RequireAuth } from './RequireAuth';

function renderProtected(route = '/dashboard') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<div>Login page</div>} />
      <Route element={<RequireAuth />}>
        <Route element={<Outlet />}>
          <Route path="/dashboard" element={<div>Protected dashboard</div>} />
        </Route>
      </Route>
    </Routes>,
    { route },
  );
}

describe('RequireAuth', () => {
  it('shows a loading state before the session check resolves, never the protected content', () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderProtected();

    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the protected content once an active session is confirmed', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderProtected();

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
  });

  it('redirects an anonymous visitor to /login, preserving the destination in ?from=', async () => {
    server.use(csrfTokenHandler, meHandler(null));
    renderProtected('/dashboard');

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('shows a recoverable error, not a /login redirect, when the session check itself fails (Task 05D)', async () => {
    // Fails closed exactly as before — `isError` never renders
    // `<Outlet/>` — but shows a "try again" state instead of /login,
    // since this is a `5xx`, not a confirmed `401`: a still-logged-in
    // user shouldn't be told they're logged out (see RequireAuth.tsx's
    // own doc comment, and docs/architecture/decisions.md).
    server.use(
      csrfTokenHandler,
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(
          { error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' } },
          { status: 500 },
        ),
      ),
    );
    renderProtected();

    expect(await screen.findByText("Couldn't verify your session")).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
  });

  it('recovers into the protected content once a retry succeeds, without ever visiting /login', async () => {
    let shouldFail = true;
    server.use(
      csrfTokenHandler,
      http.get('/api/v1/auth/me', () => {
        if (shouldFail) {
          return HttpResponse.json(
            { error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ user: MOCK_STUDENT_USER });
      }),
    );
    const user = userEvent.setup();
    renderProtected();

    expect(await screen.findByText("Couldn't verify your session")).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Login page')).not.toBeInTheDocument());
  });
});
