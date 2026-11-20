import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

function TestHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open modal</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete item"
        footer={<button onClick={() => setIsOpen(false)}>Confirm</button>}
      >
        <button>Inner action</button>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('is not rendered until opened, and focuses its first focusable element on open', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    expect(screen.getByRole('dialog', { name: 'Delete item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('closes on Escape and restores focus to the trigger that opened it', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const trigger = screen.getByRole('button', { name: 'Open modal' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when the backdrop (outside the dialog) is clicked', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    if (!backdrop) throw new Error('Expected the dialog to have a backdrop parent.');

    fireEvent.pointerDown(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps Tab focus within the dialog, wrapping at both ends', async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const closeButton = screen.getByRole('button', { name: 'Close' });
    const innerAction = screen.getByRole('button', { name: 'Inner action' });
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(innerAction).toHaveFocus();

    await user.tab();
    expect(confirmButton).toHaveFocus();

    // Wraps back to the first element instead of escaping the dialog.
    await user.tab();
    expect(closeButton).toHaveFocus();

    // And Shift+Tab from the first element wraps to the last.
    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();
  });
});
