import { z } from 'zod';
import {
  ResourceCreateInputSchema,
  ResourceDifficultySchema,
  ResourceTypeSchema,
  ResourceUpdateInputSchema,
  ResourceVisibilitySchema,
  type ResourceCreateInput,
  type ResourceDetail,
  type ResourceUpdateInput,
} from '@academy-library/contracts';
import { isSafeHttpUrl } from '../../shared/data/resources';

export const DURATION_TYPES = new Set(['VIDEO', 'RECORDING']);

export const ResourceFormValuesSchema = z
  .object({
    type: ResourceTypeSchema,
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(4000, 'Description is too long'),
    difficulty: ResourceDifficultySchema,
    creatorName: z.string().trim().min(1, 'Creator name is required').max(160, 'Name is too long'),
    creatorAffiliation: z.string().max(160, 'Affiliation is too long'),
    coverImageUrl: z
      .string()
      .refine((value) => value === '' || isSafeHttpUrl(value), 'Enter a valid http(s) URL'),
    sourceUrl: z
      .string()
      .refine((value) => value === '' || isSafeHttpUrl(value), 'Enter a valid http(s) URL'),
    courseIds: z.array(z.string()),
    tags: z.array(z.string().min(1)),
    publishedAt: z.string(),
    publisher: z.string().max(160, 'Publisher is too long'),
    durationMinutes: z.string(),
    visibility: ResourceVisibilitySchema,
    restrictedToGroupIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (DURATION_TYPES.has(values.type)) {
      const minutes = Number(values.durationMinutes);
      if (!values.durationMinutes || !Number.isFinite(minutes) || minutes <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['durationMinutes'],
          message: 'Duration (in minutes) is required for this resource type.',
        });
      }
    }
    if (values.visibility === 'RESTRICTED' && values.restrictedToGroupIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['restrictedToGroupIds'],
        message: 'Select at least one group this resource is restricted to.',
      });
    }
  });

export type ResourceFormValues = z.infer<typeof ResourceFormValuesSchema>;

export const CREATE_DEFAULTS: ResourceFormValues = {
  type: 'ARTICLE',
  title: '',
  description: '',
  difficulty: 'BEGINNER',
  creatorName: '',
  creatorAffiliation: '',
  coverImageUrl: '',
  sourceUrl: '',
  courseIds: [],
  tags: [],
  publishedAt: '',
  publisher: '',
  durationMinutes: '',
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
};

export function toFormValues(detail: ResourceDetail): ResourceFormValues {
  return {
    type: detail.type,
    title: detail.title,
    description: detail.description,
    difficulty: detail.difficulty,
    creatorName: detail.creator.name,
    creatorAffiliation: detail.creator.affiliation ?? '',
    coverImageUrl: detail.coverImageUrl ?? '',
    sourceUrl: detail.sourceUrl ?? '',
    courseIds: detail.courses.map((course) => course.id),
    tags: detail.tags,
    publishedAt: detail.publishedAt ? detail.publishedAt.slice(0, 10) : '',
    publisher: detail.publisher ?? '',
    durationMinutes:
      'durationSeconds' in detail ? String(Math.round(detail.durationSeconds / 60)) : '',
    visibility: detail.visibility,
    restrictedToGroupIds: detail.restrictedToGroupIds,
  };
}

function buildCreator(values: ResourceFormValues) {
  const affiliation = values.creatorAffiliation.trim();
  return affiliation
    ? { name: values.creatorName.trim(), affiliation }
    : { name: values.creatorName.trim() };
}

/** Builds and validates the real `ResourceCreateInput` from this form's
 * own internal values — never trusted structurally just because it
 * compiles (same discipline as `resource.mapper.ts` on the backend and
 * `HttpResourceRepository` on the frontend). */
export function toCreateInput(values: ResourceFormValues): ResourceCreateInput {
  const needsDuration = DURATION_TYPES.has(values.type);
  return ResourceCreateInputSchema.parse({
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim(),
    difficulty: values.difficulty,
    creator: buildCreator(values),
    coverImageUrl: values.coverImageUrl.trim() || undefined,
    sourceUrl: values.sourceUrl.trim() || undefined,
    courseIds: values.courseIds,
    tags: values.tags,
    publishedAt: values.publishedAt ? new Date(values.publishedAt).toISOString() : undefined,
    publisher: values.publisher.trim() || undefined,
    visibility: values.visibility,
    restrictedToGroupIds: values.restrictedToGroupIds,
    ...(needsDuration ? { durationSeconds: Math.round(Number(values.durationMinutes) * 60) } : {}),
  });
}

/**
 * PATCH semantics: only a field RHF considers "dirty" (changed from
 * what the form loaded with) is included at all — an untouched field is
 * omitted entirely, which `ResourceUpdateInputSchema` treats as
 * "unchanged," never as "clear this." Clearing a field the user *did*
 * touch sends an explicit `null`, the only way this schema can tell
 * "leave alone" and "wipe it out" apart. `type`/`durationMinutes`
 * changing either one resends `durationSeconds` together, so the
 * backend's merged-invariant check always sees a consistent pair rather
 * than comparing a brand-new type against a stale duration it was never
 * told changed.
 */
export function buildUpdateInput(
  values: ResourceFormValues,
  dirtyFields: Partial<Record<keyof ResourceFormValues, unknown>>,
): ResourceUpdateInput {
  const patch: Record<string, unknown> = {};

  if (dirtyFields.title) patch.title = values.title.trim();
  if (dirtyFields.description) patch.description = values.description.trim();
  if (dirtyFields.type) patch.type = values.type;
  if (dirtyFields.difficulty) patch.difficulty = values.difficulty;
  if (dirtyFields.creatorName || dirtyFields.creatorAffiliation) {
    patch.creator = buildCreator(values);
  }
  if (dirtyFields.coverImageUrl) patch.coverImageUrl = values.coverImageUrl.trim() || null;
  if (dirtyFields.sourceUrl) patch.sourceUrl = values.sourceUrl.trim() || null;
  if (dirtyFields.courseIds) patch.courseIds = values.courseIds;
  if (dirtyFields.tags) patch.tags = values.tags;
  if (dirtyFields.publishedAt) {
    patch.publishedAt = values.publishedAt ? new Date(values.publishedAt).toISOString() : null;
  }
  if (dirtyFields.publisher) patch.publisher = values.publisher.trim() || null;
  if (dirtyFields.durationMinutes || dirtyFields.type) {
    const needsDuration = DURATION_TYPES.has(values.type);
    patch.durationSeconds =
      needsDuration && values.durationMinutes
        ? Math.round(Number(values.durationMinutes) * 60)
        : null;
  }
  if (dirtyFields.visibility) patch.visibility = values.visibility;
  if (dirtyFields.restrictedToGroupIds || dirtyFields.visibility) {
    patch.restrictedToGroupIds = values.restrictedToGroupIds;
  }

  return ResourceUpdateInputSchema.parse(patch);
}
