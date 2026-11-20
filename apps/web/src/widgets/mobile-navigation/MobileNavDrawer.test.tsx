import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AUTH_ME_QUERY_KEY } from '../../features/auth/api/useCurrentUser';
import { createTestQueryClient } from '../../test/renderWithProviders';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { MobileNavDrawer } from './MobileNavDrawer';

function TestHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(AUTH_ME_QUERY_KEY, MOCK_STUDENT_USER);

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <button onClick={() => setIsOpen(true)}>Open navigation</button>
        <MobileNavDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MobileNavDrawer', () => {
  it('is not rendered until opened, and focuses its first focusable element on open', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Academy Library' })).toHaveFocus();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    if (!backdrop) throw new Error('Expected the drawer to have a backdrop parent.');

    fireEvent.pointerDown(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when a navigation link is activated', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('link', { name: 'Explore Library' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps Tab focus within the drawer', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    const brandLink = screen.getByRole('link', { name: 'Academy Library' });
    const closeButton = screen.getByRole('button', { name: 'Close navigation' });

    expect(brandLink).toHaveFocus();

    // Shift+Tab from the first element wraps to the last.
    await user.tab({ shift: true });
    const lastNavLink = screen.getByRole('link', { name: 'Settings' });
    expect(lastNavLink).toHaveFocus();

    // Tabbing forward from the brand link goes to the close button next.
    brandLink.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();
  });
});
