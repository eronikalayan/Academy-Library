import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import type { DashboardStats } from '@academy-library/contracts';
import { server } from '../../test/mswServer';
import { dashboardStatsHandler, meHandler, resourceSummaryFor } from '../../test/mswHandlers';
import { MOCK_LECTURER_USER, MOCK_STUDENT_USER } from '../../test/authFixtures';
import { dashboardRepository } from '../../shared/data/dashboard';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DashboardPage } from './DashboardPage';

const EMPTY_STATS: DashboardStats = {
  totalAccessibleResources: 0,
  savedResourcesCount: 0,
  availableCollectionsCount: 0,
  activeLoansCount: 0,
  recentResources: [],
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/library" element={<p>Library stub</p>} />
      <Route path="/library/new" element={<p>Create resource stub</p>} />
    </Routes>,
    { route: '/dashboard' },
  );
}

describe('DashboardPage', () => {
  it('renders every stat from the real response, never a placeholder', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      dashboardStatsHandler({
        totalAccessibleResources: 12,
        savedResourcesCount: 3,
        availableCollectionsCount: 4,
        activeLoansCount: 1,
        recentResources: [],
      }),
    );
    renderPage();

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows recently added resources as cards', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      dashboardStatsHandler({
        ...EMPTY_STATS,
        recentResources: [resourceSummaryFor({ id: 'res-1', title: 'Freshly Added Resource' })],
      }),
    );
    renderPage();

    expect(await screen.findByText('Freshly Added Resource')).toBeInTheDocument();
  });

  it('shows an empty-activity state when there is nothing recent', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), dashboardStatsHandler(EMPTY_STATS));
    renderPage();

    expect(await screen.findByText('Your activity will show up here')).toBeInTheDocument();
  });

  it('shows "Create a resource" only for a LECTURER/ADMIN, not a STUDENT', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), dashboardStatsHandler(EMPTY_STATS));
    renderPage();

    await screen.findByText('Your activity will show up here');
    expect(screen.queryByRole('button', { name: 'Create a resource' })).not.toBeInTheDocument();
  });

  it('shows "Create a resource" for a LECTURER and navigates to /library/new', async () => {
    server.use(meHandler(MOCK_LECTURER_USER), dashboardStatsHandler(EMPTY_STATS));
    const user = userEvent.setup();
    renderPage();

    const createButton = await screen.findByRole('button', { name: 'Create a resource' });
    await user.click(createButton);
    expect(await screen.findByText('Create resource stub')).toBeInTheDocument();
  });

  it('shows an error state with a working retry action', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), dashboardStatsHandler(EMPTY_STATS));
    const user = userEvent.setup();
    vi.spyOn(dashboardRepository, 'getStats')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    renderPage();

    expect(await screen.findByText("Couldn't load your dashboard")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Your activity will show up here')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
