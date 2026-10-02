/**
 * Next.js server startup hook.
 *
 * In a real production runtime the full environment validation boundary runs
 * here and fails startup closed when required configuration is missing,
 * placeholder, or localhost-bound. Skipped during `next build` (NEXT_PHASE)
 * and on non-nodejs runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.NODE_ENV !== 'production') return;

  const { validateProductionEnvironment } = await import('@video-factory/contracts');
  validateProductionEnvironment('web-startup');
}
