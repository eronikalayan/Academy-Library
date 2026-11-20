import { describe, expect, it } from 'vitest';
import {
  ResourceCreateInputSchema,
  ResourceDetailSchema,
  ResourceListQuerySchema,
  ResourceSummaryListResponseSchema,
  ResourceSummarySchema,
  ResourceUpdateInputSchema,
} from './resource.js';

const BASE_DETAIL = {
  id: 'res-1',
  title: 'Intro to Algorithms',
  description: 'A thorough grounding in algorithmic thinking.',
  difficulty: 'BEGINNER',
  creator: { name: 'R. Kesari' },
  tags: ['algorithms'],
  courses: [],
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  capabilities: { canEdit: false, canDelete: false },
};

describe('ResourceDetailSchema', () => {
  it('accepts a BOOK with no durationSeconds', () => {
    const result = ResourceDetailSchema.safeParse({ ...BASE_DETAIL, type: 'BOOK' });
    expect(result.success).toBe(true);
  });

  it('rejects a VIDEO missing durationSeconds', () => {
    const result = ResourceDetailSchema.safeParse({ ...BASE_DETAIL, type: 'VIDEO' });
    expect(result.success).toBe(false);
  });

  it('accepts a RECORDING with a positive durationSeconds', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'RECORDING',
      durationSeconds: 1800,
    });
    expect(result.success).toBe(true);
  });

  it('rejects durationSeconds on a BOOK (not part of that branch)', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      durationSeconds: 1800,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown resource type', () => {
    const result = ResourceDetailSchema.safeParse({ ...BASE_DETAIL, type: 'PODCAST' });
    expect(result.success).toBe(false);
  });

  it('rejects RESTRICTED visibility with no groups listed', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      visibility: 'RESTRICTED',
      restrictedToGroupIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts RESTRICTED visibility with at least one group', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      visibility: 'RESTRICTED',
      restrictedToGroupIds: ['lecturers'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed sourceUrl', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      sourceUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a syntactically well-formed but unsafe sourceUrl scheme', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      sourceUrl: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a data: coverImageUrl', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      coverImageUrl: 'data:text/html,<script>alert(1)</script>',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an https sourceUrl', () => {
    const result = ResourceDetailSchema.safeParse({
      ...BASE_DETAIL,
      type: 'BOOK',
      sourceUrl: 'https://example.edu/resource',
    });
    expect(result.success).toBe(true);
  });
});

describe('ResourceSummarySchema', () => {
  it('accepts a VIDEO summary with durationSeconds', () => {
    const result = ResourceSummarySchema.safeParse({
      ...BASE_DETAIL,
      type: 'VIDEO',
      durationSeconds: 600,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a BOOK summary with no durationSeconds at all (not required)', () => {
    const result = ResourceSummarySchema.safeParse({ ...BASE_DETAIL, type: 'BOOK' });
    expect(result.success).toBe(true);
  });

  it('rejects a summary missing a required field', () => {
    const { title: _title, ...withoutTitle } = { ...BASE_DETAIL, type: 'BOOK' };
    const result = ResourceSummarySchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });
});

describe('ResourceListQuerySchema', () => {
  it('fills in defaults when given an empty object', () => {
    const result = ResourceListQuerySchema.parse({});
    expect(result).toEqual({ sort: 'newest', page: 1, pageSize: 12 });
  });

  it('coerces page/pageSize from query-string-shaped strings', () => {
    const result = ResourceListQuerySchema.parse({ page: '3', pageSize: '24' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(24);
  });

  it('rejects a page below 1', () => {
    const result = ResourceListQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported sort value', () => {
    const result = ResourceListQuerySchema.safeParse({ sort: 'oldest' });
    expect(result.success).toBe(false);
  });

  it('accepts sort: relevance without requiring a search term', () => {
    const result = ResourceListQuerySchema.safeParse({ sort: 'relevance' });
    expect(result.success).toBe(true);
  });
});

describe('ResourceSummaryListResponseSchema', () => {
  it('accepts a well-formed page of summaries', () => {
    const result = ResourceSummaryListResponseSchema.safeParse({
      items: [{ ...BASE_DETAIL, type: 'BOOK' }],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative totalItems', () => {
    const result = ResourceSummaryListResponseSchema.safeParse({
      items: [],
      page: 1,
      pageSize: 12,
      totalItems: -1,
      totalPages: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('ResourceCreateInputSchema', () => {
  const BASE_CREATE = {
    title: 'New Resource',
    description: 'A new resource.',
    difficulty: 'BEGINNER',
    creator: { name: 'A. Author' },
    tags: [],
    courseIds: [],
    visibility: 'PUBLIC',
    restrictedToGroupIds: [],
  };

  it('accepts a well-formed ARTICLE create input', () => {
    const result = ResourceCreateInputSchema.safeParse({ ...BASE_CREATE, type: 'ARTICLE' });
    expect(result.success).toBe(true);
  });

  it('rejects an EXERCISE create input that includes durationSeconds', () => {
    const result = ResourceCreateInputSchema.safeParse({
      ...BASE_CREATE,
      type: 'EXERCISE',
      durationSeconds: 120,
    });
    expect(result.success).toBe(false);
  });

  it('requires durationSeconds for a VIDEO create input', () => {
    const result = ResourceCreateInputSchema.safeParse({ ...BASE_CREATE, type: 'VIDEO' });
    expect(result.success).toBe(false);
  });

  it('does not accept id/createdAt/updatedAt as part of the create input', () => {
    const parsed = ResourceCreateInputSchema.parse({ ...BASE_CREATE, type: 'ARTICLE' });
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('createdAt');
  });
});

describe('ResourceUpdateInputSchema', () => {
  it('accepts an empty object (nothing to change)', () => {
    const result = ResourceUpdateInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('does not inject default empty arrays for omitted fields', () => {
    const parsed = ResourceUpdateInputSchema.parse({ title: 'Renamed' });
    expect(parsed).toEqual({ title: 'Renamed' });
  });

  it('rejects switching to RESTRICTED without listing groups', () => {
    const result = ResourceUpdateInputSchema.safeParse({ visibility: 'RESTRICTED' });
    expect(result.success).toBe(false);
  });

  it('accepts switching to RESTRICTED with groups listed', () => {
    const result = ResourceUpdateInputSchema.safeParse({
      visibility: 'RESTRICTED',
      restrictedToGroupIds: ['admins'],
    });
    expect(result.success).toBe(true);
  });
});
