import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { server } from '../../test/mswServer';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { csrfTokenHandler, logoutHandler, meHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AUTH_ME_QUERY_KEY } from '../../features/auth/api/useCurrentUser';
import { ProfileMenu } from './ProfileMenu';

function renderProfileMenu(queryClient?: QueryClient) {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<ProfileMenu />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route: '/dashboard', queryClient },
  );
}

describe('ProfileMenu', () => {
  it("shows the real signed-in user's name and role, not a placeholder identity", async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_LECTURER_USER));
    const user = userEvent.setup();
    renderProfileMenu();

    await user.click(await screen.findByRole('button', { name: 'Account menu' }));

    expect(screen.getByText(MOCK_LECTURER_USER.displayName)).toBeInTheDocument();
    expect(screen.getByText('Lecturer')).toBeInTheDocument();
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument();
  });

  it('signs out and navigates to /login on Sign out', async () => {
    // `staleTime: Infinity` — the pre-seeded data below is the only
    // source of truth this test wants; without it, `useCurrentUser`'s
    // default refetch-on-mount would fire a second, unmocked `/me`
    // request racing against the logout assertions below. A real
    // (non-zero) `gcTime` matters too: `ProfileMenu` is this cache
    // entry's only observer in this isolated test, and navigating to
    // `/login` unmounts it — with `gcTime: 0` (this app's usual test
    // default) that eviction would race the assertion below, when in
    // the real app other still-mounted consumers (header, sidebar)
    // would keep the entry alive regardless.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_LECTURER_USER);
    server.use(csrfTokenHandler, logoutHandler);
    const user = userEvent.setup();
    renderProfileMenu(queryClient);

    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(queryClient.getQueryData(AUTH_ME_QUERY_KEY)).toBeNull();
  });
});
