import type { BookCopy, Loan } from '@academy-library/contracts';
import { toResourceSummary } from '../resources/resource.mapper.js';
import type { BookCopyRecord, LoanWithRelationsRecord } from './physicalLibrary.provider.js';

export function toBookCopy(record: BookCopyRecord): BookCopy {
  return {
    id: record.id,
    resourceId: record.resourceId,
    inventoryCode: record.inventoryCode,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** `isOverdue` is computed here, at response-build time, never stored —
 * see the `Loan` model's doc comment in schema.prisma for why. */
export function toLoan(record: LoanWithRelationsRecord): Loan {
  const isOverdue = record.status === 'ACTIVE' && record.dueAt.getTime() < Date.now();
  return {
    id: record.id,
    copy: {
      id: record.copy.id,
      inventoryCode: record.copy.inventoryCode,
      resource: toResourceSummary(record.copy.resource),
    },
    borrower: record.borrower,
    status: record.status,
    borrowedAt: record.borrowedAt.toISOString(),
    dueAt: record.dueAt.toISOString(),
    returnedAt: record.returnedAt ? record.returnedAt.toISOString() : null,
    isOverdue,
  };
}
