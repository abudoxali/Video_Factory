FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install Chromium, FFmpeg, Cairo, and Arabic fonts for Remotion rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-kacst \
    fonts-hosny-amiri \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# 1. Dependencies stage — every workspace package.json must be present or
#    pnpm --frozen-lockfile fails to resolve the workspace graph.
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/render-worker/package.json ./apps/render-worker/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/database/package.json ./packages/database/
COPY packages/providers/package.json ./packages/providers/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# 2. Builder stage — `build` performs a full TypeScript check of the worker.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/render-worker ./apps/render-worker

ENV NODE_ENV=production
RUN pnpm --filter @video-factory/contracts build
RUN pnpm --filter @video-factory/database build
RUN pnpm --filter @video-factory/providers build
RUN pnpm --filter @video-factory/render-worker build

# 3. Runner stage.
#    NOTE: The render worker does not yet operate as an independent runtime
#    service — `src/index.ts` only re-exports modules and rendering currently
#    executes in-process inside the web service via
#    `@video-factory/render-worker/service`. This image packages the worker
#    toolchain (Chromium, FFmpeg, fonts) for a future dedicated runtime and
#    intentionally exits instead of pretending to be a server.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

CMD ["node", "-e", "console.log('[render-worker] Standalone runtime is not enabled in this release. Rendering runs in-process inside the web service via @video-factory/render-worker/service.'); process.exit(0);"]
