import type {
  ResourceCapabilities,
  ResourceDetail,
  ResourceSummary,
} from '@academy-library/contracts';
import { getCourseRefs } from './courses';
import type { ResourceFixtureRecord } from './resourceFixtures';

/** The mock has no real auth/ownership concept (see
 * `mockResourceRepository.ts`), so a fixture's `capabilities` is
 * conservative by default (neither) unless a caller explicitly knows
 * better — e.g. a test registering an MSW handler for a specific
 * viewer, the same way Task 05C.2's resource handlers pass fixture data
 * straight through. */
const DEFAULT_CAPABILITIES: ResourceCapabilities = { canEdit: false, canDelete: false };

export function toResourceSummary(record: ResourceFixtureRecord): ResourceSummary {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    type: record.type,
    difficulty: record.difficulty,
    creator: record.creator,
    courses: getCourseRefs(record.courseIds),
    tags: record.tags,
    durationSeconds: record.durationSeconds ?? null,
    visibility: record.visibility,
    publishedAt: record.publishedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
  };
}

export function toResourceDetail(
  record: ResourceFixtureRecord,
  capabilities: ResourceCapabilities = DEFAULT_CAPABILITIES,
): ResourceDetail {
  const shared = {
    id: record.id,
    title: record.title,
    description: record.description,
    difficulty: record.difficulty,
    creator: record.creator,
    sourceUrl: record.sourceUrl ?? null,
    courses: getCourseRefs(record.courseIds),
    tags: record.tags,
    publishedAt: record.publishedAt ?? null,
    publisher: record.publisher ?? null,
    visibility: record.visibility,
    restrictedToGroupIds: record.restrictedToGroupIds ?? [],
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    capabilities,
  };

  if (record.type === 'VIDEO' || record.type === 'RECORDING') {
    if (record.durationSeconds === undefined) {
      throw new Error(`Fixture ${record.id} is a ${record.type} but has no durationSeconds`);
    }
    return { ...shared, type: record.type, durationSeconds: record.durationSeconds };
  }

  return { ...shared, type: record.type };
}
