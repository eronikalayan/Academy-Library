# infra/docker

Supporting files for the Docker images built from `apps/*/Dockerfile` and
orchestrated by the root `compose.yaml`.

- `web/nginx.conf` — Nginx site config that serves the built web app and
  falls back to `index.html` for client-side routing.
- `postgres/` — reserved for database initialization scripts (none needed
  yet; Prisma migrations own schema setup).

The Dockerfiles themselves live next to the app they build
(`apps/api/Dockerfile`, `apps/web/Dockerfile`) because they reference
app-specific build steps, but they build from the repository root context
so they can access the shared `packages/*` workspaces.
