import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewToggle } from './ViewToggle';

describe('ViewToggle', () => {
  it('marks the active view with aria-pressed', () => {
    render(<ViewToggle view="grid" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onChange with the clicked view', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle view="grid" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(onChange).toHaveBeenCalledWith('list');
  });
});
