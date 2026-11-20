import { z } from 'zod';
import { CollectionSummarySchema } from './collection.js';
import { CourseRefSchema, ResourceSummarySchema } from './resource.js';

/**
 * `GET /learning` (Task 07) — this app has no `Enrollment`/progress
 * model at all (not deferred, simply nonexistent), so `/learning` never
 * claims to show personalized course progress, completed-lesson counts,
 * or a skill score — see each field's own doc comment for exactly what
 * real signal it is derived from. Every section here is "honest course
 * exploration" per the task brief's own fallback instruction, not a
 * simulation of enrollment data this app doesn't have.
 */

/** One course paired with a small, bounded preview of the visible
 * resources associated with it — "resources associated with courses,"
 * read literally: every course is shown (there are only a handful,
 * seed/admin-managed — see `docs/architecture/decisions.md`), each with
 * whatever it actually has, not filtered down to courses the viewer is
 * somehow "in" (no such relationship exists to filter by). */
export const LearningCourseGroupSchema = z
  .object({
    course: CourseRefSchema,
    resources: z.array(ResourceSummarySchema),
  })
  .strict();
export type LearningCourseGroup = z.infer<typeof LearningCourseGroupSchema>;

/** A resource recommended because it shares a course or tag with a
 * resource the viewer has saved — their only real, available behavioral
 * signal. `reason` is the "transparent" half of "simple, transparent
 * recommendations": the exact shared course/tag, stated in plain
 * language, never a hidden score. Empty when the viewer has saved
 * nothing — there is no fallback to "popular" or random resources, per
 * the task brief's "where sufficient information exists." */
export const LearningRecommendationSchema = z
  .object({
    resource: ResourceSummarySchema,
    reason: z.string().min(1),
  })
  .strict();
export type LearningRecommendation = z.infer<typeof LearningRecommendationSchema>;

export const LearningPageResponseSchema = z
  .object({
    courseGroups: z.array(LearningCourseGroupSchema),
    /** Visible collections — "learning collections relevant to the
     * current user" read as "the collections this user can actually
     * open," newest first, bounded (see `learning.service.ts`). */
    relevantCollections: z.array(CollectionSummarySchema),
    /** Most recently added resources this viewer can see — "recently
     * added learning materials," literally. */
    recentMaterials: z.array(ResourceSummarySchema),
    recommendations: z.array(LearningRecommendationSchema),
  })
  .strict();
export type LearningPageResponse = z.infer<typeof LearningPageResponseSchema>;
