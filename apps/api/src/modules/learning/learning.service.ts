import type {
  CollectionListQuery,
  LearningCourseGroup,
  LearningPageResponse,
  LearningRecommendation,
  PublicUser,
  ResourceListQuery,
  ResourceSummary,
} from '@academy-library/contracts';
import { listBookmarks } from '../bookmarks/bookmark.service.js';
import { listCollections } from '../collections/collection.service.js';
import { listAllCourses } from '../resources/resource.repository.js';
import { buildActorContext, listResources } from '../resources/resource.service.js';
import type { ActorContext } from '../resources/resource.types.js';

/** This app has no `Enrollment`/progress model — every limit below
 * exists only to keep each section a bounded preview (the same role
 * `RECENT_RESOURCES_LIMIT` plays on the Dashboard), not a page worth
 * paginating. Every fetch here reuses the exact same visibility-aware
 * service functions the Library Explorer and Collections list
 * themselves call (`listResources`/`listCollections`) — one source of
 * truth for "what can this viewer see," not a parallel query path. */
const RESOURCES_PER_COURSE_LIMIT = 4;
const RELEVANT_COLLECTIONS_LIMIT = 6;
const RECENT_MATERIALS_LIMIT = 8;
const RECOMMENDATION_SIGNAL_LIMIT = 3;
const RECOMMENDATIONS_PER_SIGNAL_LIMIT = 3;
const RECOMMENDATIONS_LIMIT = 6;

async function buildCourseGroups(actor: ActorContext | null): Promise<LearningCourseGroup[]> {
  const courses = await listAllCourses();
  const groups = await Promise.all(
    courses.map(async (course) => {
      const query: ResourceListQuery = {
        courseId: course.id,
        sort: 'newest',
        page: 1,
        pageSize: RESOURCES_PER_COURSE_LIMIT,
      };
      const response = await listResources(query, actor);
      return { course: { id: course.id, title: course.title }, resources: response.items };
    }),
  );
  // Only courses with at least one resource this viewer can actually
  // see are worth showing — an empty course card is noise, not
  // "exploration."
  return groups.filter((group) => group.resources.length > 0);
}

async function buildRelevantCollections(
  actor: ActorContext | null,
): Promise<LearningPageResponse['relevantCollections']> {
  const query: CollectionListQuery = {
    sort: 'newest',
    page: 1,
    pageSize: RELEVANT_COLLECTIONS_LIMIT,
  };
  const response = await listCollections(query, actor);
  return response.items;
}

async function buildRecentMaterials(actor: ActorContext | null): Promise<ResourceSummary[]> {
  const query: ResourceListQuery = { sort: 'newest', page: 1, pageSize: RECENT_MATERIALS_LIMIT };
  const response = await listResources(query, actor);
  return response.items;
}

/**
 * "Simple, transparent recommendations based on actual course/tag
 * associations" — the viewer's own saved resources are the only real
 * behavioral signal this app has. For each of their (bounded) most
 * recently saved resources' courses and tags, this finds other visible
 * resources sharing that exact course or tag, excluding anything
 * already saved, and records *which* course/tag justified the match as
 * `reason` — never a hidden score. Empty when the viewer has saved
 * nothing, by construction (there is no fallback to "popular" or
 * random resources).
 */
async function buildRecommendations(
  actingUser: PublicUser,
  actor: ActorContext | null,
): Promise<LearningRecommendation[]> {
  const saved = await listBookmarks(actingUser, { page: 1, pageSize: RECOMMENDATION_SIGNAL_LIMIT });
  if (saved.items.length === 0) return [];

  const savedResourceIds = new Set(saved.items.map((item) => item.resource.id));
  const seenCourseIds = new Set<string>();
  const seenTags = new Set<string>();
  const recommended = new Map<string, LearningRecommendation>();

  const addCandidates = (candidates: ResourceSummary[], reason: string): void => {
    for (const candidate of candidates) {
      if (savedResourceIds.has(candidate.id) || recommended.has(candidate.id)) continue;
      recommended.set(candidate.id, { resource: candidate, reason });
    }
  };

  for (const { resource } of saved.items) {
    for (const course of resource.courses) {
      if (seenCourseIds.has(course.id) || seenCourseIds.size >= RECOMMENDATION_SIGNAL_LIMIT)
        continue;
      seenCourseIds.add(course.id);

      const response = await listResources(
        {
          courseId: course.id,
          sort: 'newest',
          page: 1,
          pageSize: RECOMMENDATIONS_PER_SIGNAL_LIMIT,
        },
        actor,
      );
      addCandidates(response.items, `Also in ${course.title}`);
    }

    for (const tag of resource.tags) {
      if (seenTags.has(tag) || seenTags.size >= RECOMMENDATION_SIGNAL_LIMIT) continue;
      seenTags.add(tag);

      const response = await listResources(
        { tags: [tag], sort: 'newest', page: 1, pageSize: RECOMMENDATIONS_PER_SIGNAL_LIMIT },
        actor,
      );
      addCandidates(response.items, `Shares the "${tag}" tag with a resource you saved`);
    }
  }

  return [...recommended.values()].slice(0, RECOMMENDATIONS_LIMIT);
}

export async function getLearningPage(actingUser: PublicUser): Promise<LearningPageResponse> {
  const actor = await buildActorContext(actingUser);

  const [courseGroups, relevantCollections, recentMaterials, recommendations] = await Promise.all([
    buildCourseGroups(actor),
    buildRelevantCollections(actor),
    buildRecentMaterials(actor),
    buildRecommendations(actingUser, actor),
  ]);

  return { courseGroups, relevantCollections, recentMaterials, recommendations };
}
