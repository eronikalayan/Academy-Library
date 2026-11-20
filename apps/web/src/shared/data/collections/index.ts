import { HttpCollectionRepository } from './httpCollectionRepository';
import type { CollectionRepository } from './CollectionRepository';

export type { CollectionRepository } from './CollectionRepository';
export { HttpCollectionRepository } from './httpCollectionRepository';

/** The one export every caller uses — same pattern as
 * `shared/data/resources/index.ts`. There is no mock implementation
 * here: frontend tests mock the network boundary directly via MSW
 * (`test/mswHandlers.ts`), the same approach the Resource domain's own
 * component/page tests already use; a separate in-memory mock
 * repository class would be a second thing to keep in sync with the
 * real contracts for no benefit this task needs. */
export const collectionRepository: CollectionRepository = new HttpCollectionRepository();
