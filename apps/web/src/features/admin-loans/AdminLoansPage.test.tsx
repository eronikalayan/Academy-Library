import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mswServer';
import { csrfTokenHandler, loanFor, meHandler, resourceSummaryFor } from '../../test/mswHandlers';
import { MOCK_ADMIN_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AdminLoansPage } from './AdminLoansPage';

function renderPage() {
  return renderWithProviders(<AdminLoansPage />, { route: '/admin/loans' });
}

function statusAwareAllLoansHandler(
  activeItems: ReturnType<typeof loanFor>[],
  returnedItems: ReturnType<typeof loanFor>[],
) {
  return http.get('/api/v1/loans/all', ({ request }) => {
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

describe('AdminLoansPage', () => {
  it('shows an empty state when there are no active loans', async () => {
    server.use(meHandler(MOCK_ADMIN_USER), statusAwareAllLoansHandler([], []));
    renderPage();

    expect(await screen.findByText('No active loans')).toBeInTheDocument();
  });

  it('lists every borrower’s active loan with their name', async () => {
    const resource = resourceSummaryFor({ id: 'res-1', title: 'Borrowed Book' });
    server.use(
      meHandler(MOCK_ADMIN_USER),
      statusAwareAllLoansHandler(
        [loanFor(resource, { borrower: { id: 'user-x', displayName: 'Pat Patron' } })],
        [],
      ),
    );
    renderPage();

    expect(await screen.findByText('Borrowed Book')).toBeInTheDocument();
    expect(screen.getByText('Pat Patron')).toBeInTheDocument();
  });

  it('marking a loan returned calls the return endpoint and shows a success toast', async () => {
    const resource = resourceSummaryFor({ id: 'res-2', title: 'To Be Returned' });
    let returnCalled = false;
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_ADMIN_USER),
      statusAwareAllLoansHandler([loanFor(resource, { id: 'loan-42' })], []),
      http.patch('/api/v1/loans/loan-42', () => {
        returnCalled = true;
        return HttpResponse.json(
          loanFor(resource, {
            id: 'loan-42',
            status: 'RETURNED',
            returnedAt: new Date().toISOString(),
          }),
        );
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Mark returned' }));

    expect(await screen.findByText('Loan marked returned')).toBeInTheDocument();
    expect(returnCalled).toBe(true);
  });

  it('shows "Mark returned" only on the Active tab, not on Returned', async () => {
    const resource = resourceSummaryFor({ id: 'res-3', title: 'Already Returned' });
    server.use(
      meHandler(MOCK_ADMIN_USER),
      statusAwareAllLoansHandler(
        [],
        [loanFor(resource, { status: 'RETURNED', returnedAt: new Date().toISOString() })],
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('No active loans');
    await user.click(screen.getByRole('tab', { name: 'Returned' }));

    expect(await screen.findByText('Already Returned')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark returned' })).not.toBeInTheDocument();
  });
});
