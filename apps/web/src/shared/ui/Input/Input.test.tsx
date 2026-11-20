import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input so it is reachable by accessible name', () => {
    render(<Input label="Email address" />);

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('accepts typed input', async () => {
    const user = userEvent.setup();
    render(<Input label="Email address" />);

    const input = screen.getByLabelText('Email address');
    await user.type(input, 'hello@example.com');

    expect(input).toHaveValue('hello@example.com');
  });

  it('shows helper text when there is no error', () => {
    render(<Input label="Email address" helperText="We'll never share this." />);

    expect(screen.getByText("We'll never share this.")).toBeInTheDocument();
  });

  it('marks the input invalid and announces the error, replacing the helper text', () => {
    render(
      <Input
        label="Email address"
        helperText="We'll never share this."
        error="Enter a valid email address"
      />,
    );

    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Enter a valid email address');
    expect(screen.queryByText("We'll never share this.")).not.toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
  });
});
