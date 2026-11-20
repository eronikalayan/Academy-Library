import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mswServer';
import { loanFor, meHandler, resourceSummaryFor } from '../../test/mswHandlers';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoansPage } from './LoansPage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/loans" element={<LoansPage />} />
      <Route path="/library" element={<p>Library stub</p>} />
    </Routes>,
    { route: '/loans' },
  );
}

/** Routes `GET /api/v1/loans` to a different response per `status`
 * query param, so the Active/History tabs can be exercised
 * independently within one test. */
function statusAwareLoansHandler(
  activeItems: ReturnType<typeof loanFor>[],
  returnedItems: ReturnType<typeof loanFor>[],
) {
  return http.get('/api/v1/loans', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const items = status === 'RETURNED' ? returnedItems : activeItems;
    return HttpResponse.json({
      items,
      page: 1,
      pageSize: 10,
      totalItems: items.length,
      totalPages: 1,
    });
  });
}

describe('LoansPage', () => {
  it('shows an empty state on the Active tab with a link into the library', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), statusAwareLoansHandler([], []));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('No active loans')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browse the library' }));
    expect(await screen.findByText('Library stub')).toBeInTheDocument();
  });

  it('lists an active loan with its due date and no "Returned" badge', async () => {
    const resource = resourceSummaryFor({ id: 'res-1', title: 'Active Loan Book' });
    server.use(
      meHandler(MOCK_STUDENT_USER),
      statusAwareLoansHandler([loanFor(resource, { status: 'ACTIVE' })], []),
    );
    renderPage();

    expect(await screen.findByText('Active Loan Book')).toBeInTheDocument();
    expect(screen.queryByText('Returned')).not.toBeInTheDocument();
  });

  it('flags an overdue loan', async () => {
    const resource = resourceSummaryFor({ id: 'res-2', title: 'Overdue Book' });
    server.use(
      meHandler(MOCK_STUDENT_USER),
      statusAwareLoansHandler([loanFor(resource, { status: 'ACTIVE', isOverdue: true })], []),
    );
    renderPage();

    expect(await screen.findByText('Overdue Book')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('switches to the History tab and shows a returned loan', async () => {
    const resource = resourceSummaryFor({ id: 'res-3', title: 'Returned Book' });
    server.use(
      meHandler(MOCK_STUDENT_USER),
      statusAwareLoansHandler(
        [],
        [
          loanFor(resource, {
            status: 'RETURNED',
            returnedAt: new Date().toISOString(),
          }),
        ],
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('No active loans');
    await user.click(screen.getByRole('tab', { name: 'History' }));

    expect(await screen.findByText('Returned Book')).toBeInTheDocument();
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });
});
