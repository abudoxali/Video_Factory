import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce .next/standalone for the production Docker image (apps/web/Dockerfile).
  output: 'standalone',
  // Monorepo: trace server dependencies from the workspace root so pnpm-linked
  // packages are correctly captured into the standalone output.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Remotion's programmatic toolchain must stay external (it spawns headless
  // Chromium + the Remotion compositor binary) — never bundled by webpack.
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@remotion/cli'],
  // The Remotion compositor binaries are spawned (not require()'d), so nft
  // misses them — force-trace the platform packages for the render route.
  // Include globs resolve relative to this app dir; the pnpm store lives at
  // the workspace root, hence the ../../ prefix.
  outputFileTracingIncludes: {
    '/api/videos/[id]/render': ['../../node_modules/.pnpm/@remotion+compositor*/**'],
  },
  transpilePackages: [
    '@video-factory/contracts',
    '@video-factory/database',
    '@video-factory/ui',
    '@video-factory/providers',
    '@video-factory/render-worker',
  ],
};

export default nextConfig;
