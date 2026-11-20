-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('BOOK', 'ARTICLE', 'VIDEO', 'EXERCISE', 'RECORDING', 'OTHER');

-- CreateEnum
CREATE TYPE "ResourceDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('PUBLIC', 'RESTRICTED');

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "type" "ResourceType" NOT NULL,
    "difficulty" "ResourceDifficulty" NOT NULL,
    "creatorName" VARCHAR(160) NOT NULL,
    "creatorAffiliation" VARCHAR(160),
    "coverImageUrl" TEXT,
    "sourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publisher" VARCHAR(160),
    "durationSeconds" INTEGER,
    "visibility" "ResourceVisibility" NOT NULL DEFAULT 'PUBLIC',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_tags" (
    "resourceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "resource_tags_pkey" PRIMARY KEY ("resourceId","tagId")
);

-- CreateTable
CREATE TABLE "resource_courses" (
    "resourceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "resource_courses_pkey" PRIMARY KEY ("resourceId","courseId")
);

-- CreateTable
CREATE TABLE "resource_groups" (
    "resourceId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "resource_groups_pkey" PRIMARY KEY ("resourceId","groupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE INDEX "group_memberships_groupId_idx" ON "group_memberships"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_userId_groupId_key" ON "group_memberships"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_title_key" ON "courses"("title");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "resources_ownerId_idx" ON "resources"("ownerId");

-- CreateIndex
CREATE INDEX "resources_type_idx" ON "resources"("type");

-- CreateIndex
CREATE INDEX "resources_difficulty_idx" ON "resources"("difficulty");

-- CreateIndex
CREATE INDEX "resources_visibility_idx" ON "resources"("visibility");

-- CreateIndex
CREATE INDEX "resources_createdAt_idx" ON "resources"("createdAt");

-- CreateIndex
CREATE INDEX "resource_tags_tagId_idx" ON "resource_tags"("tagId");

-- CreateIndex
CREATE INDEX "resource_courses_courseId_idx" ON "resource_courses"("courseId");

-- CreateIndex
CREATE INDEX "resource_groups_groupId_idx" ON "resource_groups"("groupId");

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_courses" ADD CONSTRAINT "resource_courses_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_courses" ADD CONSTRAINT "resource_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Hand-written additions below this line — none of these are expressible
-- in schema.prisma, so `prisma migrate dev` will never regenerate them.
-- See the `Resource` model's doc comment in schema.prisma for the full
-- rationale and the future-drift warning this creates (same family as
-- Task 05A's `users_email_lower_key` functional index).
-- ---------------------------------------------------------------------

-- `durationSeconds` is required for VIDEO/RECORDING and must be absent
-- for every other type (see ResourceDetailSchema/ResourceCreateInputSchema
-- in packages/contracts/src/resource.ts, which enforce this per-branch at
-- the contract layer; resource.service.ts enforces it again for PATCH,
-- which is flat and must be checked against the merged resulting state).
-- This CHECK constraint is the third, DB-level layer of the same
-- invariant — belt-and-suspenders, not the primary mechanism.
ALTER TABLE "resources" ADD CONSTRAINT "resources_duration_matches_type_check" CHECK (
  (
    "type" IN ('VIDEO', 'RECORDING')
    AND "durationSeconds" IS NOT NULL
    AND "durationSeconds" > 0
  )
  OR (
    "type" NOT IN ('VIDEO', 'RECORDING')
    AND "durationSeconds" IS NULL
  )
);

-- `pg_trgm` backs the trigram index on `tags.name` below, used for
-- partial/substring tag matching during search (see
-- resource.repository.ts and docs/domain/resources.md, "Search
-- implementation"). Not used for title/description — those rely on
-- `websearch_to_tsquery`'s own stemming, not trigram similarity; genuine
-- typo-tolerant full-text ranking is out of scope, see the same doc's
-- "Known limitations".
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- A `GENERATED ALWAYS ... STORED` column has no schema.prisma syntax, so
-- it is added here as a plain `ALTER TABLE` rather than inline in the
-- `CREATE TABLE "resources"` statement above (which Prisma generated with
-- no such column at all — the `Unsupported("tsvector")` field in
-- schema.prisma exists only so Prisma Client knows to never read or
-- write it). Postgres recomputes this automatically on every insert/
-- update of the four source columns; the application never writes to it
-- directly. Weighted: title (A) > creator (B) > publisher (C) >
-- description (D) — title matches rank highest, a throwaway mention deep
-- in a long description ranks lowest. Tag names are deliberately NOT
-- folded into this vector — they live in a separate join table, and a
-- `GENERATED` column can only reference columns on its own row; tag
-- matching is instead a separate join + trigram condition at query time
-- (see resource.repository.ts), contributing a fixed relevance boost
-- rather than a weighted rank component.
ALTER TABLE "resources" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("creatorName", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("publisher", '')), 'C') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'D')
) STORED;

CREATE INDEX "resources_search_vector_idx" ON "resources" USING GIN ("searchVector");

-- Trigram index for substring/partial tag-name matching (`ILIKE
-- '%term%'`) — a plain B-tree index can't serve that access pattern
-- efficiently; GIN + gin_trgm_ops can.
CREATE INDEX "tags_name_trgm_idx" ON "tags" USING GIN ("name" gin_trgm_ops);
