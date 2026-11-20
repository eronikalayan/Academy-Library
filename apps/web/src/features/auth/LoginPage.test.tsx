import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { clearCsrfToken } from '../../shared/api/csrfToken';
import { server } from '../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { csrfTokenHandler, invalidLoginHandler, loginHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoginPage } from './LoginPage';

function renderLoginPage(route = '/login') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<div>Dashboard page</div>} />
      <Route path="/library/:id" element={<div>Resource detail page</div>} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  clearCsrfToken();
});

describe('LoginPage', () => {
  it('logs in successfully and navigates to /dashboard by default', async () => {
    server.use(csrfTokenHandler, loginHandler(MOCK_STUDENT_USER));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/^Email/), MOCK_STUDENT_USER.email);
    await user.type(screen.getByLabelText(/^Password/), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('honors a safe ?from= destination after a successful login', async () => {
    server.use(csrfTokenHandler, loginHandler(MOCK_STUDENT_USER));
    const user = userEvent.setup();
    renderLoginPage('/login?from=%2Flibrary%2Fabc');

    await user.type(screen.getByLabelText(/^Email/), MOCK_STUDENT_USER.email);
    await user.type(screen.getByLabelText(/^Password/), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Resource detail page')).toBeInTheDocument();
  });

  it('ignores an unsafe ?from= destination and falls back to /dashboard', async () => {
    server.use(csrfTokenHandler, loginHandler(MOCK_STUDENT_USER));
    const user = userEvent.setup();
    renderLoginPage('/login?from=https%3A%2F%2Fevil.example.com');

    await user.type(screen.getByLabelText(/^Email/), MOCK_STUDENT_USER.email);
    await user.type(screen.getByLabelText(/^Password/), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows a generic error for invalid credentials, naming neither field specifically', async () => {
    server.use(csrfTokenHandler, invalidLoginHandler);
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/^Email/), 'nobody@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    // Still on the login page — no navigation happened.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows client-side validation messages without ever calling the network for an empty submission', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it('disables the submit button and shows a busy state while the request is in flight', async () => {
    server.use(
      csrfTokenHandler,
      http.post('/api/v1/auth/login', async () => {
        await delay(50);
        return HttpResponse.json({ user: MOCK_STUDENT_USER });
      }),
    );
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/^Email/), MOCK_STUDENT_USER.email);
    await user.type(screen.getByLabelText(/^Password/), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('links to the registration page', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register');
  });
});
