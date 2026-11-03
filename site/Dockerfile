# The landing site: built with Vite from the repo (README, changelog, examples, demo videos and the
# library itself), then served as static files by Caddy. Build context: the repo root.
FROM node:24-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm@11
# Packages download from the lockfile alone, so this layer stays cached until it changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY package.json ./
RUN pnpm install --offline --frozen-lockfile
COPY . .
RUN pnpm site:build

FROM caddy:2-alpine
COPY site/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/site/dist /srv
