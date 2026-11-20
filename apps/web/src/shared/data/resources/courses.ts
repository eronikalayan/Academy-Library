import type { CourseRef } from '@academy-library/contracts';

/**
 * Fixture course references. There is no Course domain/endpoint yet — this
 * exists only so the mock Resource repository has something realistic to
 * associate resources with and the Library Explorer's course filter has
 * options to show. See docs/domain/resources.md.
 */
export const COURSES: readonly CourseRef[] = [
  { id: 'cs101', title: 'Introduction to Computer Science' },
  { id: 'algo201', title: 'Algorithms & Data Structures' },
  { id: 'db301', title: 'Databases at Scale' },
  { id: 'ml401', title: 'Machine Learning Foundations' },
  { id: 'swarch302', title: 'Software Architecture' },
  { id: 'research110', title: 'Research Methods & Academic Writing' },
  { id: 'stats210', title: 'Statistics for Data Science' },
  { id: 'design150', title: 'Human-Centered Design' },
];

const COURSES_BY_ID = new Map(COURSES.map((course) => [course.id, course]));

export function getCourseRefs(courseIds: readonly string[]): CourseRef[] {
  return courseIds
    .map((id) => COURSES_BY_ID.get(id))
    .filter((course): course is CourseRef => course !== undefined);
}
