/**
 * Integration boundary for Reel — lesson recording synchronization
 * (Task 07). The third of this task's three named integration
 * boundaries — see `skillMap.ts` (external learning recommendations,
 * same directory) and
 * `../modules/physical-library/physicalLibrary.provider.ts` (Depot,
 * physical inventory and borrowing — the one of the three actually
 * wired into a real, local implementation today, since Physical
 * Library is a feature this task builds; Reel and Skill Map are not).
 *
 * This file defines ONLY this app's own internal contract
 * for what a Reel integration would need to satisfy; it does not guess
 * Reel's real production API, which this task's brief explicitly says
 * not to invent. There is no implementation of `ReelProvider` anywhere
 * in this codebase, no stub, no fake sync job, and nothing here is
 * wired into any route, service, or scheduled task — only the shape a
 * future adapter would fill in.
 *
 * Why this shape: a `RECORDING`-type `Resource` (see schema.prisma —
 * introduced in Task 05B, well before this boundary) is this app's
 * existing representation of a recorded lesson. "Lesson recording
 * synchronization" reads most naturally as "discover recordings Reel
 * has published and reflect them here" — `listRecordings` below is
 * exactly that discovery step, the one operation a sync process would
 * need before it could decide what to create/update as a `RECORDING`
 * resource. Nothing about *writing* that sync logic is implemented —
 * the task brief asks to isolate the integration boundary, not to
 * build a background worker that doesn't yet have a real counterpart
 * to talk to (which the brief also explicitly says to avoid).
 */

/** One recording as Reel would describe it — this app's own minimal
 * shape, not Reel's real response format (unknown, and not guessed
 * at). `externalId` is Reel's identifier for the recording, kept
 * distinct from any `Resource.id` this app might later mint for it —
 * the two are never assumed to be the same id space. */
export interface ReelRecording {
  externalId: string;
  title: string;
  durationSeconds: number;
  /** ISO 8601 */
  recordedAt: string;
  playbackUrl: string;
}

export interface ReelProvider {
  /**
   * Recordings Reel has available, optionally narrowed to those
   * created/updated since a given cursor (an opaque string a real
   * adapter would define the meaning of — a timestamp, a page token,
   * whatever Reel's own API returns) — how a future one-way sync would
   * avoid re-processing everything on every run, without this app
   * needing to know anything about how Reel paginates internally.
   */
  listRecordings(since?: string): Promise<ReelRecording[]>;
}
