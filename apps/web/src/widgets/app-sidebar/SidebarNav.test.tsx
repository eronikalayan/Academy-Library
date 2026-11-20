import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { PublicUser } from '@academy-library/contracts';
import { AUTH_ME_QUERY_KEY } from '../../features/auth/api/useCurrentUser';
import { createTestQueryClient } from '../../test/renderWithProviders';
import { MOCK_ADMIN_USER, MOCK_STUDENT_USER } from '../../test/authFixtures';
import { SidebarNav } from './SidebarNav';

function renderSidebar(initialPath: string, user: PublicUser | null = MOCK_STUDENT_USER) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(AUTH_ME_QUERY_KEY, user);

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <SidebarNav />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

function switchUser(queryClient: QueryClient, user: PublicUser) {
  queryClient.setQueryData(AUTH_ME_QUERY_KEY, user);
}

describe('SidebarNav', () => {
  it('marks the link matching the current route as active', () => {
    renderSidebar('/library');

    expect(screen.getByRole('link', { name: 'Explore Library' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('hides the admin section for the default (STUDENT) role', () => {
    renderSidebar('/dashboard');

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage Resources' })).not.toBeInTheDocument();
  });

  it('shows the admin section for an ADMIN user', () => {
    renderSidebar('/dashboard', MOCK_ADMIN_USER);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage Resources' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  it('reacts to the underlying user changing, without remounting', async () => {
    const { queryClient } = renderSidebar('/dashboard', MOCK_STUDENT_USER);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();

    switchUser(queryClient, MOCK_ADMIN_USER);

    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });

  it('hides every role-gated item while the session has not resolved yet', () => {
    renderSidebar('/dashboard', null);

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('updates the active link when navigating between pages', async () => {
    const user = userEvent.setup();
    renderSidebar('/dashboard');

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explore Library' })).not.toHaveAttribute(
      'aria-current',
    );

    await user.click(screen.getByRole('link', { name: 'Explore Library' }));

    expect(screen.getByRole('link', { name: 'Explore Library' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when a link is activated, so the mobile drawer can close itself', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_STUDENT_USER);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <SidebarNav onNavigate={onNavigate} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('link', { name: 'Explore Library' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
