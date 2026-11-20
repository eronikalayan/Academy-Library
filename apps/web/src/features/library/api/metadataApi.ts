import { z } from 'zod';
import { CourseRefSchema, GroupRefSchema } from '@academy-library/contracts';
import type { CourseRef, GroupRef } from '@academy-library/contracts';
import { apiRequest } from '../../../shared/api/httpClient';

const CourseRefListSchema = z.array(CourseRefSchema);
const GroupRefListSchema = z.array(GroupRefSchema);

/** Thin wrappers over `GET /api/v1/courses`/`GET /api/v1/groups` (Task
 * 05C.3) — read-only metadata the resource create/edit form needs for
 * real course/restricted-group choices, matching
 * `features/auth/api/authApi.ts`'s plain-function style rather than a
 * class: there's no mock/swap-implementation need for these (unlike
 * `ResourceRepository`), just one real endpoint each. */
export function fetchCourses(signal?: AbortSignal): Promise<CourseRef[]> {
  return apiRequest('/courses', (data) => CourseRefListSchema.parse(data), { signal });
}

export function fetchGroups(signal?: AbortSignal): Promise<GroupRef[]> {
  return apiRequest('/groups', (data) => GroupRefListSchema.parse(data), { signal });
}
