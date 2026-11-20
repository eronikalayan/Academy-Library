# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# ---- base: shared pnpm setup -------------------------------------------
FROM node:${NODE_VERSION} AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install full dependency graph for the workspace -------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript and generate the Prisma client ----------
# Also used directly by the `migrate` compose service, which needs the
# Prisma CLI (a devDependency) to run `prisma migrate deploy`.
FROM deps AS build
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @academy-library/api db:generate
RUN pnpm --filter @academy-library/contracts build
RUN pnpm --filter @academy-library/api build

# packages/contracts' package.json intentionally points `main`/`exports` at
# its own TypeScript source (not `dist/`) everywhere else in this repo —
# tsx (dev), Vite/Vitest (web), and tsc (type-checking) all transparently
# handle a workspace dependency's `.ts` source directly, so no separate
# contracts build is ever required for those. Plain `node dist/server.js`
# (this image's runtime — no TS loader registered) cannot: it needs a real
# `.js` file to resolve to. This patches *only this built image's copy* of
# contracts' package.json to point at the `dist/` output just built above,
# leaving the source-controlled package.json (and every other consumer)
# untouched. Surfaced by Task 05A: it's the first code in apps/api to need
# a runtime (not type-only) import from @academy-library/contracts.
RUN node -e "\
  const fs = require('node:fs'); \
  const path = 'packages/contracts/package.json'; \
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8')); \
  pkg.main = './dist/index.js'; \
  pkg.types = './dist/index.d.ts'; \
  pkg.exports = { '.': { types: './dist/index.d.ts', default: './dist/index.js' } }; \
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n'); \
"

# ---- pruned: drop devDependencies for a lean runtime copy ---------------
# The Prisma client is generated directly into node_modules, and pnpm's
# isolated node_modules gives each workspace package its own symlinks to
# its direct dependencies. Both of those are easy to lose with piecemeal
# copies (and with `pnpm deploy`, which does not reliably carry over
# generated, non-store output), so the runtime image below copies this
# whole pruned workspace tree wholesale instead of hand-picking paths.
FROM build AS pruned
RUN pnpm prune --prod

# ---- runtime: minimal, non-root production image -----------------------
FROM node:${NODE_VERSION} AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S academy && adduser -S academy -G academy

COPY --from=pruned /app ./

USER academy

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["node", "dist/server.js"]
