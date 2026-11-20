import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResourceSummary } from '@academy-library/contracts';
import { Route, Routes } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { bookmarkFor, bookmarksHandler, meHandler } from '../../test/mswHandlers';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { bookmarkRepository } from '../../shared/data/bookmarks';
import { renderWithProviders } from '../../test/renderWithProviders';
import { SavedPage } from './SavedPage';

function resourceSummary(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
  return {
    id: 'res-1',
    title: 'Introduction to Algorithms',
    description: 'A thorough grounding in algorithmic thinking.',
    type: 'BOOK',
    difficulty: 'BEGINNER',
    creator: { name: 'R. Kesari' },
    coverImageUrl: null,
    courses: [],
    tags: [],
    durationSeconds: null,
    visibility: 'PUBLIC',
    publishedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/saved" element={<SavedPage />} />
      <Route path="/library" element={<p>Library stub</p>} />
    </Routes>,
    { route: '/saved' },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SavedPage', () => {
  it('shows an empty state with a link into the library when nothing is saved', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), bookmarksHandler());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('No saved resources yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browse the library' }));
    expect(await screen.findByText('Library stub')).toBeInTheDocument();
  });

  it('renders each saved resource as a card', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      bookmarksHandler({
        items: [bookmarkFor(resourceSummary())],
        page: 1,
        pageSize: 12,
        totalItems: 1,
        totalPages: 1,
      }),
    );
    renderPage();

    expect(await screen.findByText('Introduction to Algorithms')).toBeInTheDocument();
  });

  it('shows pagination controls once saved resources span more than one page (Task 07)', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      bookmarksHandler({
        items: [bookmarkFor(resourceSummary())],
        page: 1,
        pageSize: 12,
        totalItems: 25,
        totalPages: 3,
      }),
    );
    renderPage();

    await screen.findByText('Introduction to Algorithms');
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
  });

  it('shows an error state with a working retry action', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), bookmarksHandler());
    const user = userEvent.setup();
    // Same pattern as `ResourceDetailsPage.test.tsx`'s equivalent test:
    // `shouldRetryTransientFailure` retries a plain failure twice before
    // giving up — three rejections exhausts that budget; the next call
    // (the "Try again" click) falls through to the real, MSW-backed
    // implementation.
    vi.spyOn(bookmarkRepository, 'list')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    renderPage();

    expect(await screen.findByText("Couldn't load your saved resources")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No saved resources yet')).toBeInTheDocument();
  });
});
