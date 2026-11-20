import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from './FilterPanel';

describe('FilterPanel', () => {
  it('starts with the draft matching the applied filters', () => {
    render(<FilterPanel filters={{ type: 'BOOK' }} onApply={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByLabelText('Resource type')).toHaveValue('BOOK');
  });

  it('applies the draft selections (type, difficulty, course, tags) on Apply', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FilterPanel filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Resource type'), 'BOOK');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'BEGINNER');
    await user.click(screen.getByLabelText('algorithms'));
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(onApply).toHaveBeenCalledWith({
      type: 'BOOK',
      difficulty: 'BEGINNER',
      courseId: undefined,
      tags: ['algorithms'],
    });
  });

  it('does not apply filters until Apply is clicked', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FilterPanel filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Resource type'), 'BOOK');

    expect(onApply).not.toHaveBeenCalled();
  });

  it('calls onClear and resets the draft when Clear all is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<FilterPanel filters={{ type: 'BOOK' }} onApply={vi.fn()} onClear={onClear} />);

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Resource type')).toHaveValue('');
  });

  it('resets the draft back to the applied filters when they change externally', () => {
    const { rerender } = render(
      <FilterPanel filters={{ type: 'BOOK' }} onApply={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByLabelText('Resource type')).toHaveValue('BOOK');

    rerender(<FilterPanel filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByLabelText('Resource type')).toHaveValue('');
  });
});
