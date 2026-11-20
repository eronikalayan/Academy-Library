/**
 * Integration boundary for Skill Map — external learning
 * recommendations (Task 07). See `reel.ts` (same directory) for the
 * other two of this task's three named integration boundaries and why
 * only Depot (`../modules/physical-library/physicalLibrary.provider.ts`)
 * has a real local implementation today.
 *
 * Same posture as `reel.ts`: this is ONLY
 * this app's own internal contract for what a Skill Map integration
 * would need to satisfy, not a guess at Skill Map's real production
 * API. There is no implementation of `SkillMapProvider` anywhere in
 * this codebase and nothing here is wired into `learning.service.ts`
 * or any route.
 *
 * `learning.service.ts`'s `buildRecommendations` is deliberately local
 * and content-based (shared course/tag with something the viewer
 * saved) — the task brief's own "simple, transparent recommendations
 * based on actual course/tag associations" requirement, satisfiable
 * entirely from data this app already has. This interface is where a
 * *second*, external recommendation source would plug in later — most
 * plausibly *alongside* the local ones (merged, or shown as a distinct
 * "Suggested by Skill Map" section so the viewer can tell the two
 * apart), never silently replacing the honest, explainable reasoning
 * `LearningRecommendation.reason` promises today with an opaque
 * external score. That merge policy is a future task's decision, not
 * implied or implemented here.
 */

/** One recommendation as Skill Map would return it. `resourceId` is
 * only meaningful once Skill Map can resolve its own recommendation
 * back to a `Resource.id` in this app — a real adapter's problem to
 * solve, not assumed here. `score` is Skill Map's own, opaque
 * confidence figure (`0`-`1`) — unlike `LearningRecommendation.reason`
 * (always a plain-language explanation this app itself can stand
 * behind), a `score` is not inherently transparent and would need its
 * own UI treatment, not reused as a free substitute for `reason`.
 * `reason`, if Skill Map provides one, is optional precisely because
 * an external system may not explain itself the way this app's own
 * local recommendations do. */
export interface SkillMapRecommendation {
  resourceId: string;
  score: number;
  reason?: string;
}

export interface SkillMapProvider {
  getRecommendationsForUser(userId: string): Promise<SkillMapRecommendation[]>;
}
