import { HttpInventoryRepository } from './httpInventoryRepository';
import type { InventoryRepository } from './InventoryRepository';

export type { InventoryRepository } from './InventoryRepository';
export { HttpInventoryRepository } from './httpInventoryRepository';

export const inventoryRepository: InventoryRepository = new HttpInventoryRepository();
