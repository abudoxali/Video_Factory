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

# 1. Dependencies stage
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/render-worker/package.json ./apps/render-worker/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/database/package.json ./packages/database/
COPY packages/providers/package.json ./packages/providers/
RUN pnpm install --frozen-lockfile

# 2. Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps/render-worker ./apps/render-worker

ENV NODE_ENV=production
RUN pnpm --filter @video-factory/contracts build
RUN pnpm --filter @video-factory/database build
RUN pnpm --filter @video-factory/providers build
RUN pnpm --filter @video-factory/render-worker build

# 3. Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 3001

CMD ["node", "apps/render-worker/dist/index.js"]
