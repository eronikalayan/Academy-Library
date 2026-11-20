import type {
  Course,
  Group,
  Resource,
  ResourceCourse,
  ResourceGroup,
  ResourceTag,
  Tag,
} from '@prisma/client';
import type { Role } from '@academy-library/contracts';

/** The shape every repository read returns — a `Resource` row with its
 * three join tables hydrated one level deep. Both `resource.mapper.ts`
 * (building the public DTO) and `resource.policy.ts` (checking
 * visibility, which needs `ownerId` and the restricted group ids) work
 * from this same shape, so there is exactly one query shape for "a
 * resource" anywhere in this module. */
export type ResourceWithRelations = Resource & {
  tags: (ResourceTag & { tag: Tag })[];
  courses: (ResourceCourse & { course: Course })[];
  groups: (ResourceGroup & { group: Group })[];
};

/** The resolved identity a resource read/write decision is made against.
 * `null` means an anonymous (unauthenticated) request — not merely "no
 * role" — so every check below treats it as strictly less privileged
 * than any real user, including a disabled-equivalent STUDENT. */
export interface ActorContext {
  userId: string;
  role: Role;
  groupIds: readonly string[];
}
