# Academy Library

Academy Library is a centralized platform for discovering and managing
educational resources — books, articles, videos, lesson recordings, and
exercises.

This repository currently contains **Task 01: the project foundation**:
monorepo tooling, a minimal web shell, a minimal API with health/readiness
checks and database connectivity, Docker Compose, CI, and documentation.
No business features (search, tagging, courses, CRUD, bookmarks,
borrowing, Reel/Skill Map/Depot integrations, auth) are implemented yet —
see [`docs/architecture/decisions.md`](docs/architecture/decisions.md) for
the full scope boundary.

## Stack

- **Frontend:** React, TypeScript (strict), Vite, React Router (Data
  Mode), CSS Modules, TanStack Query, React Hook Form, Zod, Lucide React
- **Backend:** Node.js, Express, TypeScript (strict), PostgreSQL, Prisma,
  Zod, Pino
- **Infra:** pnpm workspaces, Docker, Docker Compose, ESLint, Prettier,
  Vitest, GitHub Actions

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/v1/health

Or run the whole stack in Docker:

```bash
cp .env.example .env
docker compose up -d --build
```

Full setup, environment variables, migrations, and quality-gate commands
are documented in [`docs/development.md`](docs/development.md).

## Documentation

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — what
  lives where and why
- [`docs/architecture/decisions.md`](docs/architecture/decisions.md) —
  significant decisions and assumptions made in this task
- [`docs/development.md`](docs/development.md) — day-to-day development
  commands

## Repository layout

```text
academy-library/
├── apps/
│   ├── web/              React + Vite frontend
│   └── api/               Express + Prisma backend
├── packages/
│   ├── contracts/         Shared Zod contracts (web ⇄ api)
│   └── config/             Shared TypeScript config
├── infra/docker/           Nginx config, Postgres init dir
├── docs/
├── compose.yaml
├── pnpm-workspace.yaml
└── package.json
```
