import { describe, expect, it } from 'vitest';
import { ResourceListQuerySchema } from '@academy-library/contracts';
import { mockResourceRepository } from './mockResourceRepository';
import { RESOURCE_FIXTURES } from './resourceFixtures';

describe('MockResourceRepository.list', () => {
  it('returns everything, paginated, when no filters are given', async () => {
    const result = await mockResourceRepository.list(ResourceListQuerySchema.parse({}));

    expect(result.totalItems).toBe(RESOURCE_FIXTURES.length);
    expect(result.items).toHaveLength(12);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(Math.ceil(RESOURCE_FIXTURES.length / 12));
  });

  it('filters by resource type', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ type: 'VIDEO', pageSize: '60' }),
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.type === 'VIDEO')).toBe(true);
  });

  it('filters by difficulty', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ difficulty: 'ADVANCED', pageSize: '60' }),
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.difficulty === 'ADVANCED')).toBe(true);
  });

  it('filters by course', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ courseId: 'db301', pageSize: '60' }),
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.courses.some((course) => course.id === 'db301'))).toBe(
      true,
    );
  });

  it('matches resources with any of the selected tags (OR within the tags facet)', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ tags: ['security', 'ethics'], pageSize: '60' }),
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every((item) => item.tags.includes('security') || item.tags.includes('ethics')),
    ).toBe(true);
  });

  it('combines search with a type filter (AND across facets)', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: 'lecture', type: 'VIDEO', pageSize: '60' }),
    );

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.type).toBe('VIDEO');
      expect(item.title.toLowerCase()).toContain('lecture');
    }
  });

  it('is case-insensitive when searching', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: 'POSTGRES' }),
    );

    expect(result.items.length).toBeGreaterThan(0);
  });

  it('sorts by newest first by default', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ pageSize: '60' }),
    );

    const createdAts = result.items.map((item) => item.createdAt);
    const sorted = [...createdAts].sort((a, b) => b.localeCompare(a));
    expect(createdAts).toEqual(sorted);
  });

  it('sorts title_asc alphabetically', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ sort: 'title_asc', pageSize: '60' }),
    );

    const titles = result.items.map((item) => item.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });

  it('orders results by non-increasing relevance score under relevance sort', async () => {
    const term = 'research';
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: term, sort: 'relevance', pageSize: '60' }),
    );

    expect(result.items.length).toBeGreaterThan(1);

    const scoreOf = (title: string, description: string, tags: string[]): number => {
      let score = 0;
      if (title.toLowerCase().includes(term)) score += 3;
      if (tags.some((tag) => tag.toLowerCase().includes(term))) score += 2;
      if (description.toLowerCase().includes(term)) score += 1;
      return score;
    };
    const scores = result.items.map((item) => scoreOf(item.title, item.description, item.tags));

    const isNonIncreasing = scores.every(
      (score, index) => index === 0 || score <= scores[index - 1]!,
    );
    expect(isNonIncreasing).toBe(true);
    // And it's not a trivially-flat ranking — this search term does
    // actually produce more than one distinct score among the results.
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('falls back to newest ordering for relevance sort with no search term', async () => {
    const relevance = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ sort: 'relevance', pageSize: '60' }),
    );
    const newest = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ sort: 'newest', pageSize: '60' }),
    );

    expect(relevance.items.map((item) => item.id)).toEqual(newest.items.map((item) => item.id));
  });

  it('paginates correctly across pages with no overlap', async () => {
    const pageSize = 5;
    const firstPage = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ page: String(1), pageSize: String(pageSize) }),
    );
    const secondPage = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ page: String(2), pageSize: String(pageSize) }),
    );

    expect(firstPage.items).toHaveLength(pageSize);
    expect(secondPage.items).toHaveLength(pageSize);
    const firstIds = new Set(firstPage.items.map((item) => item.id));
    for (const item of secondPage.items) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it('echoes an out-of-range page and returns an empty (not clamped) result, matching the real backend', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ page: '999', pageSize: '12' }),
    );

    expect(result.page).toBe(999);
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBeGreaterThan(0);
  });

  it('returns an empty page for a search term that matches nothing', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: 'xyz-does-not-exist-anywhere' }),
    );

    expect(result.items).toHaveLength(0);
    expect(result.totalItems).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
  });

  it('includes RESTRICTED resources in listings (no auth to filter by yet)', async () => {
    const result = await mockResourceRepository.list(
      ResourceListQuerySchema.parse({ search: 'enrollment records' }),
    );

    expect(result.items.some((item) => item.visibility === 'RESTRICTED')).toBe(true);
  });
});

describe('MockResourceRepository.getById', () => {
  it('returns a full detail record for a known id', async () => {
    const detail = await mockResourceRepository.getById('res-001');

    expect(detail).not.toBeNull();
    expect(detail?.title).toBe('Introduction to Algorithms');
    expect(detail?.type).toBe('BOOK');
  });

  it('includes durationSeconds for a VIDEO/RECORDING resource', async () => {
    const detail = await mockResourceRepository.getById('res-021');

    expect(detail?.type).toBe('VIDEO');
    if (detail?.type === 'VIDEO') {
      expect(detail.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('returns null for an unknown id', async () => {
    const detail = await mockResourceRepository.getById('does-not-exist');

    expect(detail).toBeNull();
  });
});
