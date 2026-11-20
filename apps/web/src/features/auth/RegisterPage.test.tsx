import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { clearCsrfToken } from '../../shared/api/csrfToken';
import { server } from '../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { csrfTokenHandler, duplicateEmailHandler, registerHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { RegisterPage } from './RegisterPage';

function renderRegisterPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route: '/register' },
  );
}

beforeEach(() => {
  clearCsrfToken();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Full name/), MOCK_STUDENT_USER.displayName);
  await user.type(screen.getByLabelText(/^Email/), MOCK_STUDENT_USER.email);
  await user.type(screen.getByLabelText(/^Password/), 'a-long-enough-password');
}

describe('RegisterPage', () => {
  it('registers successfully and redirects to /login (no auto-login)', async () => {
    server.use(csrfTokenHandler, registerHandler(MOCK_STUDENT_USER));
    const user = userEvent.setup();
    renderRegisterPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('shows a conflict message for a duplicate email and stays on the page', async () => {
    server.use(csrfTokenHandler, duplicateEmailHandler);
    const user = userEvent.setup();
    renderRegisterPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('only exposes fields the backend contract accepts (name, email, password) — no role selector', () => {
    renderRegisterPage();

    expect(screen.getByLabelText(/^Full name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/administrator/i)).not.toBeInTheDocument();
  });

  it('validates a too-short password client-side before any network call', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/^Full name/), 'Someone');
    await user.type(screen.getByLabelText(/^Email/), 'someone@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
  });

  it('links to the login page', () => {
    renderRegisterPage();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
