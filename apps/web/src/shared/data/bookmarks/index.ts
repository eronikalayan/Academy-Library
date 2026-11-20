import { HttpBookmarkRepository } from './httpBookmarkRepository';
import type { BookmarkRepository } from './BookmarkRepository';

export type { BookmarkRepository } from './BookmarkRepository';
export { HttpBookmarkRepository } from './httpBookmarkRepository';

export const bookmarkRepository: BookmarkRepository = new HttpBookmarkRepository();
