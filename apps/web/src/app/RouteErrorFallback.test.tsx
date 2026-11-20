import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type * as ReactRouterDom from 'react-router-dom';

const { useRouteErrorMock } = vi.hoisted(() => ({ useRouteErrorMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return { ...actual, useRouteError: useRouteErrorMock };
});

// `useRouteError`/`isRouteErrorResponse` only work inside a data router
// (`createBrowserRouter`), which this project's jsdom tests can't mount
// (see docs/architecture/decisions.md's "Testing strategy" section). The
// hook is mocked here so the fallback's two rendering branches can still be
// verified directly, without a real data router.
const { RouteErrorFallback } = await import('./RouteErrorFallback');

describe('RouteErrorFallback', () => {
  it('shows the status for a route error response (e.g. a 404 thrown by a loader)', () => {
    useRouteErrorMock.mockReturnValue({
      status: 404,
      statusText: 'Not Found',
      data: null,
      internal: false,
    });

    render(<RouteErrorFallback />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('404 Not Found')).toBeInTheDocument();
  });

  it('shows a generic message for an unexpected (non-route) error', () => {
    useRouteErrorMock.mockReturnValue(new Error('boom'));

    render(<RouteErrorFallback />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred while loading this page.'),
    ).toBeInTheDocument();
  });
});
