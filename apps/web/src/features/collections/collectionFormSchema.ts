import { z } from 'zod';
import {
  CollectionCreateInputSchema,
  CollectionUpdateInputSchema,
  CollectionVisibilitySchema,
  type CollectionCreateInput,
  type CollectionDetail,
  type CollectionUpdateInput,
} from '@academy-library/contracts';
import { isSafeHttpUrl } from '../../shared/data/resources';

export const CollectionFormValuesSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(4000, 'Description is too long'),
    coverImageUrl: z
      .string()
      .refine((value) => value === '' || isSafeHttpUrl(value), 'Enter a valid http(s) URL'),
    visibility: CollectionVisibilitySchema,
    restrictedToGroupIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.visibility === 'RESTRICTED' && values.restrictedToGroupIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['restrictedToGroupIds'],
        message: 'Select at least one group this collection is restricted to.',
      });
    }
  });

export type CollectionFormValues = z.infer<typeof CollectionFormValuesSchema>;

export const CREATE_DEFAULTS: CollectionFormValues = {
  title: '',
  description: '',
  coverImageUrl: '',
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
};

export function toFormValues(detail: CollectionDetail): CollectionFormValues {
  return {
    title: detail.title,
    description: detail.description,
    coverImageUrl: detail.coverImageUrl ?? '',
    visibility: detail.visibility,
    restrictedToGroupIds: detail.restrictedToGroupIds,
  };
}

/** Builds and validates the real `CollectionCreateInput` from this
 * form's own internal values — never trusted structurally just because
 * it compiles, same discipline as `resourceFormSchema.ts`'s
 * `toCreateInput`. */
export function toCreateInput(values: CollectionFormValues): CollectionCreateInput {
  return CollectionCreateInputSchema.parse({
    title: values.title.trim(),
    description: values.description.trim(),
    coverImageUrl: values.coverImageUrl.trim() || undefined,
    visibility: values.visibility,
    restrictedToGroupIds: values.restrictedToGroupIds,
  });
}

/** PATCH semantics: only a field RHF considers "dirty" is included at
 * all — same omitted-vs-explicit-null distinction as
 * `resourceFormSchema.ts`'s `buildUpdateInput`. `restrictedToGroupIds`
 * is resent whenever `visibility` changes too, so the backend's merged
 * invariant check always sees a consistent pair. */
export function buildUpdateInput(
  values: CollectionFormValues,
  dirtyFields: Partial<Record<keyof CollectionFormValues, unknown>>,
): CollectionUpdateInput {
  const patch: Record<string, unknown> = {};

  if (dirtyFields.title) patch.title = values.title.trim();
  if (dirtyFields.description) patch.description = values.description.trim();
  if (dirtyFields.coverImageUrl) patch.coverImageUrl = values.coverImageUrl.trim() || null;
  if (dirtyFields.visibility) patch.visibility = values.visibility;
  if (dirtyFields.restrictedToGroupIds || dirtyFields.visibility) {
    patch.restrictedToGroupIds = values.restrictedToGroupIds;
  }

  return CollectionUpdateInputSchema.parse(patch);
}
