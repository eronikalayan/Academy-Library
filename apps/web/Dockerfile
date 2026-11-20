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
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ---- build: type-check and produce the static bundle -------------------
FROM deps AS build
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN pnpm --filter @academy-library/web build

# ---- runtime: nginx serving the static bundle as a non-root user -------
FROM nginx:1.27-alpine AS runtime
COPY infra/docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

RUN sed -i 's/user  nginx;//' /etc/nginx/nginx.conf \
  && touch /var/run/nginx.pid \
  && chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
