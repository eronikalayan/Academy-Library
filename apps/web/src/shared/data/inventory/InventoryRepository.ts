import type { BookCopy, BookCopyListResponse } from '@academy-library/contracts';

/** The frontend's boundary onto the Physical Library's inventory
 * surface — scoped to one resource at a time (`resourceId` on every
 * method), mirroring how the real REST routes nest copies under
 * `/resources/:resourceId/copies`. There is no `delete`: a copy is
 * retired by archiving it (`archiveCopy`), never removed, so its loan
 * history survives — see the `BookCopy` model's doc comment in
 * schema.prisma. */
export interface InventoryRepository {
  listCopies(resourceId: string, signal?: AbortSignal): Promise<BookCopyListResponse>;
  registerCopy(resourceId: string, inventoryCode: string, signal?: AbortSignal): Promise<BookCopy>;
  archiveCopy(resourceId: string, copyId: string, signal?: AbortSignal): Promise<BookCopy>;
}
