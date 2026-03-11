# syntax=docker/dockerfile:1
# Build from the monorepo root:
#   docker build -f apps/api/Dockerfile -t notra-api .

# ─── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN apk add --no-cache curl unzip \
  && curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v1.3.9/bun-linux-x64-baseline.zip" -o /tmp/bun.zip \
  && unzip -q /tmp/bun.zip -d /tmp \
  && mv /tmp/bun-linux-x64-baseline/bun /usr/local/bin/bun \
  && rm -rf /tmp/bun.zip /tmp/bun-linux-x64-baseline
WORKDIR /app

# ─── Stage 2: install dependencies ────────────────────────────────────────────
FROM base AS deps

# Copy workspace manifests needed to resolve the full dependency graph
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Install all workspace deps (frozen lockfile for reproducibility)
RUN bun install --frozen-lockfile

# ─── Stage 3: build ───────────────────────────────────────────────────────────
FROM deps AS builder

# Copy source for all packages the API depends on
COPY packages/typescript-config ./packages/typescript-config
COPY packages/db ./packages/db
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN bun run build

# ─── Stage 4: production image ────────────────────────────────────────────────
FROM node:24-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 hono

WORKDIR /app

# node_modules contains all runtime deps (including workspace package symlinks)
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules

# @notra/db exports raw .ts files resolved via the node_modules symlink at runtime
COPY --from=builder --chown=hono:nodejs /app/packages/db ./packages/db

# The compiled API bundle and its manifest
COPY --from=builder --chown=hono:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=hono:nodejs /app/apps/api/package.json ./apps/api/package.json

USER hono

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
