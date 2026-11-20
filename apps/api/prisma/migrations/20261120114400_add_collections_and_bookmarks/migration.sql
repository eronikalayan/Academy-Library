-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('PUBLIC', 'RESTRICTED');

-- The three statements Prisma generated here and that were removed by
-- hand — DROP INDEX "resources_search_vector_idx", DROP INDEX
-- "tags_name_trgm_idx", and ALTER TABLE "resources" ALTER COLUMN
-- "searchVector" DROP DEFAULT — are spurious drift, not a real part of
-- this migration: `schema.prisma` cannot express the generated
-- `searchVector` column or its GIN/trigram indexes (see the `Resource`
-- model's doc comment), so Prisma's diff engine proposes "fixing" them
-- on every unrelated schema change. Verified empirically in Task 05D
-- (see docs/architecture/decisions.md) that applying the DROP COLUMN
-- DEFAULT statement fails outright against a real Postgres (generated
-- columns reject it), so this isn't a style choice — the migration
-- would not have applied at all with those lines left in.

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "coverImageUrl" TEXT,
    "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_resources" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_groups" (
    "collectionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "collection_groups_pkey" PRIMARY KEY ("collectionId","groupId")
);

-- CreateTable
CREATE TABLE "saved_resources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_ownerId_idx" ON "collections"("ownerId");

-- CreateIndex
CREATE INDEX "collections_visibility_idx" ON "collections"("visibility");

-- CreateIndex
CREATE INDEX "collections_createdAt_idx" ON "collections"("createdAt");

-- CreateIndex
CREATE INDEX "collection_resources_collectionId_position_idx" ON "collection_resources"("collectionId", "position");

-- CreateIndex
CREATE INDEX "collection_resources_resourceId_idx" ON "collection_resources"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_resources_collectionId_resourceId_key" ON "collection_resources"("collectionId", "resourceId");

-- CreateIndex
CREATE INDEX "collection_groups_groupId_idx" ON "collection_groups"("groupId");

-- CreateIndex
CREATE INDEX "saved_resources_resourceId_idx" ON "saved_resources"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_resources_userId_resourceId_key" ON "saved_resources"("userId", "resourceId");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_resources" ADD CONSTRAINT "collection_resources_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_resources" ADD CONSTRAINT "collection_resources_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_groups" ADD CONSTRAINT "collection_groups_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_groups" ADD CONSTRAINT "collection_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
