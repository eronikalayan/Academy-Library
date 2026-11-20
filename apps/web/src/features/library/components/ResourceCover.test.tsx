import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ResourceCover } from './ResourceCover';

// The cover image is decorative (`alt=""`) — it's never announced as a
// title stand-in, since the resource title already renders as real text
// next to it — so it's queried directly rather than via `getByRole('img')`
// (an `alt=""` image is presentational, not exposed with role "img").
describe('ResourceCover', () => {
  it('shows the CSS placeholder when there is no coverImageUrl', () => {
    const { container } = render(<ResourceCover type="BOOK" coverImageUrl={null} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a real image when coverImageUrl is present', () => {
    const { container } = render(
      <ResourceCover type="BOOK" coverImageUrl="https://example.edu/cover.jpg" />,
    );

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.edu/cover.jpg');
  });

  it('falls back to the placeholder if the image fails to load', () => {
    const { container } = render(
      <ResourceCover type="BOOK" coverImageUrl="https://example.edu/broken.jpg" />,
    );

    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();
    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
