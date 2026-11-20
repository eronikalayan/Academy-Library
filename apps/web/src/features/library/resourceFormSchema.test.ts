import { describe, expect, it } from 'vitest';
import type { ResourceDetail } from '@academy-library/contracts';
import {
  CREATE_DEFAULTS,
  ResourceFormValuesSchema,
  buildUpdateInput,
  toCreateInput,
  toFormValues,
  type ResourceFormValues,
} from './resourceFormSchema';

function validArticleValues(overrides: Partial<ResourceFormValues> = {}): ResourceFormValues {
  return {
    ...CREATE_DEFAULTS,
    title: 'A Valid Article',
    description: 'Enough words to pass validation.',
    creatorName: 'Test Author',
    ...overrides,
  };
}

describe('ResourceFormValuesSchema', () => {
  it('accepts a minimal valid ARTICLE', () => {
    const result = ResourceFormValuesSchema.safeParse(validArticleValues());
    expect(result.success).toBe(true);
  });

  it('rejects a missing title', () => {
    const result = ResourceFormValuesSchema.safeParse(validArticleValues({ title: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects a VIDEO with no durationMinutes', () => {
    const result = ResourceFormValuesSchema.safeParse(
      validArticleValues({ type: 'VIDEO', durationMinutes: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts a VIDEO with a positive durationMinutes', () => {
    const result = ResourceFormValuesSchema.safeParse(
      validArticleValues({ type: 'VIDEO', durationMinutes: '12' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects RESTRICTED visibility with no groups selected', () => {
    const result = ResourceFormValuesSchema.safeParse(
      validArticleValues({ visibility: 'RESTRICTED', restrictedToGroupIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts RESTRICTED visibility with at least one group selected', () => {
    const result = ResourceFormValuesSchema.safeParse(
      validArticleValues({ visibility: 'RESTRICTED', restrictedToGroupIds: ['group-1'] }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects an unsafe-scheme cover image URL', () => {
    const result = ResourceFormValuesSchema.safeParse(
      validArticleValues({ coverImageUrl: 'javascript:alert(1)' }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts an empty cover image URL (optional field)', () => {
    const result = ResourceFormValuesSchema.safeParse(validArticleValues({ coverImageUrl: '' }));
    expect(result.success).toBe(true);
  });
});

describe('toCreateInput', () => {
  it('builds a valid create payload for a non-duration type, omitting durationSeconds', () => {
    const input = toCreateInput(validArticleValues());
    expect(input.type).toBe('ARTICLE');
    expect('durationSeconds' in input).toBe(false);
  });

  it('converts durationMinutes to durationSeconds for VIDEO', () => {
    const input = toCreateInput(validArticleValues({ type: 'VIDEO', durationMinutes: '5' }));
    expect(input.type).toBe('VIDEO');
    expect('durationSeconds' in input && input.durationSeconds).toBe(300);
  });

  it('omits an empty creator affiliation rather than sending an empty string', () => {
    const input = toCreateInput(validArticleValues({ creatorAffiliation: '' }));
    expect(input.creator).toEqual({ name: 'Test Author' });
  });

  it('includes a trimmed, non-empty creator affiliation', () => {
    const input = toCreateInput(validArticleValues({ creatorAffiliation: '  MIT  ' }));
    expect(input.creator).toEqual({ name: 'Test Author', affiliation: 'MIT' });
  });
});

describe('buildUpdateInput', () => {
  it('includes only dirty fields, omitting everything untouched', () => {
    const values = validArticleValues({ title: 'Changed Title' });
    const patch = buildUpdateInput(values, { title: true });
    expect(patch).toEqual({ title: 'Changed Title' });
  });

  it('sends an explicit null when a touched optional field is cleared', () => {
    const values = validArticleValues({ publisher: '' });
    const patch = buildUpdateInput(values, { publisher: true });
    expect(patch).toEqual({ publisher: null });
  });

  it('resends durationSeconds when only the type changes away from VIDEO', () => {
    const values = validArticleValues({ type: 'ARTICLE', durationMinutes: '' });
    const patch = buildUpdateInput(values, { type: true });
    expect(patch).toEqual({ type: 'ARTICLE', durationSeconds: null });
  });

  it('resends durationSeconds when only durationMinutes changes for an existing VIDEO', () => {
    const values = validArticleValues({ type: 'VIDEO', durationMinutes: '10' });
    const patch = buildUpdateInput(values, { durationMinutes: true });
    expect(patch).toEqual({ durationSeconds: 600 });
  });

  it('resends restrictedToGroupIds whenever visibility changes', () => {
    const values = validArticleValues({ visibility: 'RESTRICTED', restrictedToGroupIds: ['g1'] });
    const patch = buildUpdateInput(values, { visibility: true });
    expect(patch).toEqual({ visibility: 'RESTRICTED', restrictedToGroupIds: ['g1'] });
  });

  it('returns an empty patch when nothing is dirty', () => {
    const patch = buildUpdateInput(validArticleValues(), {});
    expect(patch).toEqual({});
  });
});

describe('toFormValues', () => {
  const baseDetail: ResourceDetail = {
    id: 'res-1',
    type: 'ARTICLE',
    title: 'Existing Article',
    description: 'Already exists.',
    difficulty: 'INTERMEDIATE',
    creator: { name: 'Jane Doe', affiliation: 'Some University' },
    coverImageUrl: null,
    sourceUrl: 'https://example.edu/article',
    tags: ['systems-design'],
    courses: [{ id: 'course-1', title: 'Databases at Scale' }],
    publishedAt: '2023-01-15T00:00:00.000Z',
    publisher: 'Some Press',
    visibility: 'PUBLIC',
    restrictedToGroupIds: [],
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    capabilities: { canEdit: true, canDelete: true },
  };

  it('maps a ResourceDetail into form values, including resolved courseIds', () => {
    const values = toFormValues(baseDetail);
    expect(values.title).toBe('Existing Article');
    expect(values.courseIds).toEqual(['course-1']);
    expect(values.creatorAffiliation).toBe('Some University');
    expect(values.publishedAt).toBe('2023-01-15');
  });

  it('converts durationSeconds to whole durationMinutes for VIDEO/RECORDING', () => {
    const videoDetail: ResourceDetail = {
      ...baseDetail,
      type: 'VIDEO',
      durationSeconds: 125,
    };
    const values = toFormValues(videoDetail);
    expect(values.durationMinutes).toBe('2');
  });
});
