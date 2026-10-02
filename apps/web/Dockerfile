# Debian-based stages (not alpine): Remotion's compositor binaries and
# headless Chromium require glibc. All stages share one base so binaries
# resolved during install match the runtime image.
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Dependencies stage — every workspace package.json must be present or
#    pnpm --frozen-lockfile fails to resolve the workspace graph.
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/render-worker/package.json ./apps/render-worker/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/database/package.json ./packages/database/
COPY packages/providers/package.json ./packages/providers/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# 2. Builder stage — restore the pnpm workspace node_modules layout before
#    overlaying real sources (workspace packages carry symlinked deps).
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/render-worker ./apps/render-worker

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @video-factory/contracts build
RUN pnpm --filter @video-factory/database build
RUN pnpm --filter @video-factory/providers build
RUN pnpm --filter @video-factory/web build

# Pre-bundle the Remotion composition into a static serve dir — the runtime
# then only needs @remotion/renderer + a browser, not the bundler/webpack
# toolchain or the TypeScript sources.
RUN pnpm --filter @video-factory/render-worker exec node scripts/prebundle.mjs /app/render-bundle

# 3. Production runner — Next.js standalone output + real Remotion render
#    toolchain (system Chromium, ffmpeg for probing, Arabic fonts).
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  ffmpeg \
  fontconfig \
  fonts-noto-core \
  fonts-noto-ui-core \
  fonts-kacst \
  fonts-hosny-amiri \
  fonts-liberation \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Remotion runtime wiring: pre-bundled composition + system Chromium.
ENV REMOTION_SERVE_URL=/app/render-bundle
ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
ENV REMOTION_CHROME_MODE=chrome-for-testing

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs \
  && mkdir -p /home/nextjs && chown nextjs:nodejs /home/nextjs
# Headless Chromium + fontconfig need a real writable HOME (user-data dir,
# font cache). --system users get HOME=/nonexistent otherwise and the
# browser fails to launch.
ENV HOME=/home/nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/render-bundle ./render-bundle

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
