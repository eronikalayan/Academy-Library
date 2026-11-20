import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './useTheme';

const STORAGE_KEY = 'academy-library:theme';

function Status() {
  const { theme } = useTheme();
  return <p data-testid="theme-status">{theme}</p>;
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <Status />
      <ThemeToggle />
    </ThemeProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeProvider / ThemeToggle', () => {
  it('defaults to following the system preference, with no explicit data-theme set', () => {
    renderWithProvider();

    expect(screen.getByTestId('theme-status')).toHaveTextContent('system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(screen.getByRole('button', { name: 'Match system theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switching to dark sets data-theme and persists the choice', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole('button', { name: 'Dark theme' }));

    expect(screen.getByTestId('theme-status')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('switching back to system clears the explicit choice', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(screen.getByRole('button', { name: 'Match system theme' }));

    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores a previously persisted explicit theme on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    renderWithProvider();

    expect(screen.getByTestId('theme-status')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
