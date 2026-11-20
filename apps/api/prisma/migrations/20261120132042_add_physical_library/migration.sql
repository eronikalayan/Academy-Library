-- Prisma's own diff against `schema.prisma` proposed dropping
-- "resources_search_vector_idx"/"tags_name_trgm_idx" and clearing
-- "resources"."searchVector"'s DEFAULT here — the exact same drift
-- documented in Task 05D's decisions.md and repeated in every migration
-- since (see the Collections/Bookmarks migration's own copy of this
-- note). None of that is real: `searchVector` is a GENERATED ALWAYS
-- column and both indexes are hand-written, so Prisma's introspection
-- of its own `schema.prisma` (which only ever declares `searchVector`
-- as `Unsupported("tsvector")`, with no DEFAULT) disagrees with what
-- migration SQL actually created. Deliberately removed from this
-- migration — see schema.prisma's `Resource.searchVector` doc comment.

-- CreateEnum
CREATE TYPE "BookCopyStatus" AS ENUM ('AVAILABLE', 'ON_LOAN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateTable
CREATE TABLE "book_copies" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "inventoryCode" VARCHAR(64) NOT NULL,
    "status" "BookCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_copies_resourceId_idx" ON "book_copies"("resourceId");

-- CreateIndex
CREATE INDEX "book_copies_status_idx" ON "book_copies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "book_copies_inventoryCode_key" ON "book_copies"("inventoryCode");

-- CreateIndex
CREATE INDEX "loans_userId_status_idx" ON "loans"("userId", "status");

-- CreateIndex
CREATE INDEX "loans_copyId_idx" ON "loans"("copyId");

-- CreateIndex
CREATE INDEX "loans_dueAt_idx" ON "loans"("dueAt");

-- AddForeignKey
ALTER TABLE "book_copies" ADD CONSTRAINT "book_copies_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "book_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written, not expressible in schema.prisma: Prisma's schema DSL
-- has no syntax for a partial/filtered unique index. Guarantees at the
-- database level that a given physical copy can never have more than
-- one ACTIVE loan at once — defense-in-depth underneath the real,
-- primary guarantee (a row-locked transaction around every borrow/
-- return, see localPhysicalLibraryProvider.ts's lockResourceForUpdate).
-- See the `Loan` model's doc comment in schema.prisma for the full
-- rationale — same documented-drift family as the functional
-- lower(email) index (Task 05A) and the generated searchVector column
-- (Task 05B), both also invisible to `schema.prisma` and both also
-- flagged there so a future `prisma migrate dev` diff is never accepted
-- blindly against this file.
CREATE UNIQUE INDEX "loans_active_copy_unique" ON "loans"("copyId") WHERE "status" = 'ACTIVE';
