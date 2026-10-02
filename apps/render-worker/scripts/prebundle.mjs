/**
 * Pre-bundles the Remotion entry point into a static serve URL directory.
 * Used by the production Docker build so the runtime image only needs
 * @remotion/renderer (no webpack/esbuild at render time).
 *
 * Usage: node scripts/prebundle.mjs [outDir]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || path.join(packageDir, 'render-bundle');
const entryPoint = path.join(packageDir, 'src/remotion-entry.tsx');
const publicDir = path.join(packageDir, 'public');

const serveUrl = await bundle({
  entryPoint,
  publicDir,
  outDir,
});

console.log(`Remotion bundle written to: ${serveUrl}`);
