import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the Academy Library heading and a link into the app', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Academy Library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter the library' })).toBeInTheDocument();
  });
});
