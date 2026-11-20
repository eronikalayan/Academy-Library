import { HttpResourceRepository } from './httpResourceRepository';
import type { ResourceRepository } from './ResourceRepository';

export type { ResourceRepository } from './ResourceRepository';
export { MockResourceRepository, mockResourceRepository } from './mockResourceRepository';
export { HttpResourceRepository } from './httpResourceRepository';
export { COURSES, getCourseRefs } from './courses';
export { ALL_RESOURCE_TAGS } from './resourceFixtures';
export type { ResourceFixtureRecord } from './resourceFixtures';
export { isSafeHttpUrl } from './url';

/**
 * As of Task 05C.2, the real `/api/v1/resources` backend (Task 05B) is
 * live — this is that one-line change `docs/domain/resources.md`
 * anticipated: `mockResourceRepository` → `new HttpResourceRepository()`.
 * Every caller goes through this export, never the concrete classes
 * directly, so nothing outside this file needed to change.
 *
 * `mockResourceRepository` is not deleted — it stays available (imported
 * directly, bypassing this export) for isolated tests and dev scenarios
 * that deliberately want deterministic, backend-free data. Production
 * code must never fall back to it: if the real API is unreachable, that
 * surfaces as a genuine query error (see `features/library/resourceErrors.ts`),
 * never a silent swap to fixture data.
 */
export const resourceRepository: ResourceRepository = new HttpResourceRepository();
