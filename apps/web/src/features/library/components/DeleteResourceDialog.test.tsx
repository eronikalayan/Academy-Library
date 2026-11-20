import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteResourceDialog } from './DeleteResourceDialog';

describe('DeleteResourceDialog', () => {
  it('names the resource and requires explicit confirmation before calling onConfirm', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteResourceDialog
        isOpen
        resourceTitle="Introduction to Algorithms"
        onCancel={onCancel}
        onConfirm={onConfirm}
        isDeleting={false}
      />,
    );

    expect(screen.getByText(/Introduction to Algorithms/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete resource' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel, not onConfirm, when Cancel is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteResourceDialog
        isOpen
        resourceTitle="Introduction to Algorithms"
        onCancel={onCancel}
        onConfirm={onConfirm}
        isDeleting={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a pending state and disables Cancel while deleting', () => {
    render(
      <DeleteResourceDialog
        isOpen
        resourceTitle="Introduction to Algorithms"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isDeleting
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete resource' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('shows a server error message when deletion fails', () => {
    render(
      <DeleteResourceDialog
        isOpen
        resourceTitle="Introduction to Algorithms"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isDeleting={false}
        error={new Error('network error')}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it('renders nothing when closed', () => {
    render(
      <DeleteResourceDialog
        isOpen={false}
        resourceTitle="Introduction to Algorithms"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(screen.queryByText(/Introduction to Algorithms/)).not.toBeInTheDocument();
  });
});
