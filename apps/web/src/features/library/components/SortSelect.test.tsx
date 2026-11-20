import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortSelect } from './SortSelect';

describe('SortSelect', () => {
  it('does not offer Relevance when there is no active search term', () => {
    render(<SortSelect sort="newest" hasSearchTerm={false} onChange={vi.fn()} />);

    expect(screen.queryByRole('option', { name: 'Relevance' })).not.toBeInTheDocument();
  });

  it('offers Relevance once there is an active search term', () => {
    render(<SortSelect sort="relevance" hasSearchTerm onChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'Relevance' })).toBeInTheDocument();
  });

  it('calls onChange with the selected sort', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortSelect sort="newest" hasSearchTerm={false} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Title A–Z');

    expect(onChange).toHaveBeenCalledWith('title_asc');
  });
});
