import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { learningPageHandler, meHandler, resourceSummaryFor } from '../../test/mswHandlers';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { learningRepository } from '../../shared/data/learning';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LearningPage } from './LearningPage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/learning" element={<LearningPage />} />
      <Route path="/library" element={<p>Library stub</p>} />
    </Routes>,
    { route: '/learning' },
  );
}

describe('LearningPage', () => {
  it('shows an empty state when there is nothing to explore', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      learningPageHandler({
        courseGroups: [],
        relevantCollections: [],
        recentMaterials: [],
        recommendations: [],
      }),
    );
    renderPage();

    expect(await screen.findByText('Nothing to explore yet')).toBeInTheDocument();
  });

  it('groups resources under their course heading', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      learningPageHandler({
        courseGroups: [
          {
            course: { id: 'course-1', title: 'Algorithms & Data Structures' },
            resources: [resourceSummaryFor({ id: 'res-1', title: 'Big-O Notation' })],
          },
        ],
        relevantCollections: [],
        recentMaterials: [],
        recommendations: [],
      }),
    );
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Algorithms & Data Structures' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Big-O Notation')).toBeInTheDocument();
  });

  it('shows a recommendation with its transparent reason', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      learningPageHandler({
        courseGroups: [],
        relevantCollections: [],
        recentMaterials: [],
        recommendations: [
          {
            resource: resourceSummaryFor({ id: 'res-2', title: 'Related Resource' }),
            reason: 'Also in Algorithms & Data Structures',
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText('Related Resource')).toBeInTheDocument();
    expect(screen.getByText('Also in Algorithms & Data Structures')).toBeInTheDocument();
  });

  it('shows relevant collections', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      learningPageHandler({
        courseGroups: [],
        relevantCollections: [
          {
            id: 'col-1',
            title: 'Algorithms Study Materials',
            description: 'A curated reading order.',
            coverImageUrl: null,
            visibility: 'PUBLIC',
            resourceCount: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        recentMaterials: [],
        recommendations: [],
      }),
    );
    renderPage();

    expect(await screen.findByText('Algorithms Study Materials')).toBeInTheDocument();
  });

  it('shows recently added materials', async () => {
    server.use(
      meHandler(MOCK_STUDENT_USER),
      learningPageHandler({
        courseGroups: [],
        relevantCollections: [],
        recentMaterials: [resourceSummaryFor({ id: 'res-3', title: 'Newest Material' })],
        recommendations: [],
      }),
    );
    renderPage();

    expect(await screen.findByText('Newest Material')).toBeInTheDocument();
  });

  it('shows an error state with a working retry action', async () => {
    server.use(meHandler(MOCK_STUDENT_USER), learningPageHandler());
    vi.spyOn(learningRepository, 'getLearningPage')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    renderPage();

    expect(await screen.findByText("Couldn't load your learning page")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
