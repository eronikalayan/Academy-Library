import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { RESOURCE_INCLUDE } from '../resources/resource.repository.js';
import type {
  BookCopyRecord,
  LoanPageRecord,
  LoanWithRelationsRecord,
  PhysicalLibraryProvider,
} from './physicalLibrary.provider.js';
import type { ListLoansParams } from './physicalLibrary.types.js';

/** How long a self-service borrow lasts — a policy local to *this*
 * provider; a future Depot-backed provider would presumably return
 * whatever due date Depot's own circulation rules compute, not
 * necessarily this constant. */
export const LOAN_PERIOD_DAYS = 21;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const LOAN_INCLUDE = {
  copy: { include: { resource: { include: RESOURCE_INCLUDE } } },
  user: { select: { id: true, displayName: true } },
} satisfies Prisma.LoanInclude;

type LoanRow = Prisma.LoanGetPayload<{ include: typeof LOAN_INCLUDE }>;

function toLoanRecord(row: LoanRow): LoanWithRelationsRecord {
  return {
    id: row.id,
    copyId: row.copyId,
    userId: row.userId,
    status: row.status,
    borrowedAt: row.borrowedAt,
    dueAt: row.dueAt,
    returnedAt: row.returnedAt,
    createdAt: row.createdAt,
    copy: {
      id: row.copy.id,
      resourceId: row.copy.resourceId,
      inventoryCode: row.copy.inventoryCode,
      status: row.copy.status,
      createdAt: row.copy.createdAt,
      updatedAt: row.copy.updatedAt,
      resource: row.copy.resource,
    },
    borrower: row.user,
  };
}

/**
 * Locks the owning *resource* row (not a `book_copies` row) for the
 * duration of any mutation touching that resource's copies or loans —
 * deliberately coarser than a per-copy lock: it serializes every
 * register/archive/borrow/return for a given title, which is exactly
 * what closes both races this domain has — two concurrent borrows
 * racing for the same last-available copy, AND the same user racing two
 * concurrent borrow requests against two *different* copies of the same
 * title (closing that second race needs a lock scoped to the resource;
 * a per-copy lock alone cannot see across different copies of the same
 * book). Mirrors `collection.repository.ts`'s `lockCollectionForUpdate`
 * exactly, just against a row this module doesn't itself own — a normal
 * use of `SELECT ... FOR UPDATE` on a parent row to serialize
 * child-table writes, not a module-boundary violation (this is still
 * the only module that ever writes to `book_copies`/`loans`).
 */
async function lockResourceForUpdate(
  tx: Prisma.TransactionClient,
  resourceId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM resources WHERE id = ${resourceId} FOR UPDATE`;
}

async function listLoansPage(
  where: Prisma.LoanWhereInput,
  params: ListLoansParams,
): Promise<LoanPageRecord> {
  const [totalItems, rows] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      include: LOAN_INCLUDE,
      orderBy: [{ borrowedAt: 'desc' }, { id: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);
  return { items: rows.map(toLoanRecord), totalItems };
}

export const localPhysicalLibraryProvider: PhysicalLibraryProvider = {
  async listCopies(resourceId: string): Promise<BookCopyRecord[]> {
    return prisma.bookCopy.findMany({ where: { resourceId }, orderBy: { inventoryCode: 'asc' } });
  },

  async countCopiesForResource(resourceId: string): Promise<number> {
    return prisma.bookCopy.count({ where: { resourceId } });
  },

  async findCopyById(copyId: string): Promise<BookCopyRecord | null> {
    return prisma.bookCopy.findUnique({ where: { id: copyId } });
  },

  /** Relies on `book_copies.inventoryCode`'s real DB-level unique
   * constraint as the actual source of truth (translating a `P2002`
   * violation into a clean `409`), rather than a pre-check-then-create —
   * `inventoryCode` is unique *globally*, across every resource, so the
   * per-resource lock above cannot by itself prevent two admins
   * registering the same code for two *different* books at once; only
   * the database's own constraint spans that. */
  async registerCopy(resourceId: string, inventoryCode: string): Promise<BookCopyRecord> {
    return prisma.$transaction(async (tx) => {
      await lockResourceForUpdate(tx, resourceId);
      try {
        return await tx.bookCopy.create({
          data: { resourceId, inventoryCode, status: 'AVAILABLE' },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw AppError.conflict('A copy with this inventory code already exists', {
            inventoryCode,
          });
        }
        throw error;
      }
    });
  },

  /** `AVAILABLE -> ARCHIVED` only. Re-archiving an already-`ARCHIVED`
   * copy is a harmless no-op (`200`, unchanged) — same idempotent-write
   * convention `collection.repository.ts`'s add/remove use. Archiving an
   * `ON_LOAN` copy is a genuine `409`: that copy must be returned first,
   * not silently force-archived out from under its active loan. */
  async archiveCopy(resourceId: string, copyId: string): Promise<BookCopyRecord> {
    return prisma.$transaction(async (tx) => {
      await lockResourceForUpdate(tx, resourceId);
      const copy = await tx.bookCopy.findUnique({ where: { id: copyId } });
      if (!copy || copy.resourceId !== resourceId) {
        throw AppError.notFound('Copy not found');
      }
      if (copy.status === 'ARCHIVED') {
        return copy;
      }
      if (copy.status === 'ON_LOAN') {
        throw AppError.conflict(
          'This copy is currently on loan — it must be returned before it can be archived',
        );
      }
      return tx.bookCopy.update({ where: { id: copyId }, data: { status: 'ARCHIVED' } });
    });
  },

  /**
   * The entire "prevent double booking or borrowing of the same copy"
   * and "prevent duplicate active loans" guarantee lives in this one
   * locked transaction: the resource-row lock (above) serializes every
   * concurrent borrow attempt for this title; inside that serialization,
   * a plain (non-raw-SQL) `findFirst` for "does this user already have
   * an active loan here" and "is there an available copy" is already
   * race-safe, because no other transaction touching this resource's
   * copies/loans can be interleaved with this one. The caller never
   * chooses which specific copy — the first available one, by
   * `inventoryCode`, is picked automatically (see
   * `LoanCreateInputSchema`'s doc comment in packages/contracts).
   */
  async borrowResource(resourceId: string, userId: string): Promise<LoanWithRelationsRecord> {
    const loanId = await prisma.$transaction(async (tx) => {
      await lockResourceForUpdate(tx, resourceId);

      const existingActive = await tx.loan.findFirst({
        where: { userId, status: 'ACTIVE', copy: { resourceId } },
        select: { id: true },
      });
      if (existingActive) {
        throw AppError.conflict('You already have an active loan for this resource');
      }

      const availableCopy = await tx.bookCopy.findFirst({
        where: { resourceId, status: 'AVAILABLE' },
        orderBy: { inventoryCode: 'asc' },
      });
      if (!availableCopy) {
        throw AppError.conflict('No copies of this resource are currently available');
      }

      await tx.bookCopy.update({ where: { id: availableCopy.id }, data: { status: 'ON_LOAN' } });
      const borrowedAt = new Date();
      const loan = await tx.loan.create({
        data: {
          copyId: availableCopy.id,
          userId,
          status: 'ACTIVE',
          borrowedAt,
          dueAt: addDays(borrowedAt, LOAN_PERIOD_DAYS),
        },
      });
      return loan.id;
    });

    const created = await prisma.loan.findUnique({ where: { id: loanId }, include: LOAN_INCLUDE });
    if (!created) throw new Error(`Loan ${loanId} disappeared immediately after creation`);
    return toLoanRecord(created);
  },

  /** Idempotent — marking an already-`RETURNED` loan as returned again
   * is a no-op, same reasoning as `archiveCopy`'s re-archive case. */
  async returnLoan(loanId: string): Promise<LoanWithRelationsRecord> {
    const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { copy: true } });
    if (!loan) throw AppError.notFound('Loan not found');

    await prisma.$transaction(async (tx) => {
      await lockResourceForUpdate(tx, loan.copy.resourceId);
      const current = await tx.loan.findUnique({ where: { id: loanId } });
      if (!current || current.status === 'RETURNED') return;

      await tx.loan.update({
        where: { id: loanId },
        data: { status: 'RETURNED', returnedAt: new Date() },
      });
      await tx.bookCopy.update({ where: { id: current.copyId }, data: { status: 'AVAILABLE' } });
    });

    const updated = await prisma.loan.findUnique({ where: { id: loanId }, include: LOAN_INCLUDE });
    if (!updated) throw new Error(`Loan ${loanId} disappeared immediately after return`);
    return toLoanRecord(updated);
  },

  async findLoanById(loanId: string): Promise<LoanWithRelationsRecord | null> {
    const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: LOAN_INCLUDE });
    return loan ? toLoanRecord(loan) : null;
  },

  async listLoansForUser(userId: string, params: ListLoansParams): Promise<LoanPageRecord> {
    return listLoansPage({ userId, status: params.status }, params);
  },

  async listAllLoans(params: ListLoansParams): Promise<LoanPageRecord> {
    return listLoansPage({ status: params.status }, params);
  },

  async countActiveLoansForUser(userId: string): Promise<number> {
    return prisma.loan.count({ where: { userId, status: 'ACTIVE' } });
  },
};
