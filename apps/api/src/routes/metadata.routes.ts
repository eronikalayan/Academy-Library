import { Router } from 'express';
import { requireAuth, requireRole } from '../modules/auth/auth.middleware.js';
import { listCourses, listGroups } from '../modules/resources/resource.service.js';

/**
 * Read-only metadata the resource create/edit form needs to offer real
 * choices (Task 05C.3) — courses and groups are both small, seed/admin-
 * managed sets with no CRUD surface of their own (see
 * docs/domain/resources.md), so "list everything" is the whole
 * requirement, with no pagination/search to design for. Gated to
 * `LECTURER`/`ADMIN` — the only roles that ever create or edit a
 * resource (`canCreateResource`, `resource.policy.ts`) — rather than
 * left open to every signed-in user, on a least-exposure basis; nothing
 * about either listing is sensitive, but there's no reason a STUDENT
 * session needs it either.
 */
export const metadataRouter = Router();

metadataRouter.get(
  '/courses',
  requireAuth(),
  requireRole('LECTURER', 'ADMIN'),
  async (_req, res) => {
    const courses = await listCourses();
    res.status(200).json(courses);
  },
);

metadataRouter.get(
  '/groups',
  requireAuth(),
  requireRole('LECTURER', 'ADMIN'),
  async (_req, res) => {
    const groups = await listGroups();
    res.status(200).json(groups);
  },
);
