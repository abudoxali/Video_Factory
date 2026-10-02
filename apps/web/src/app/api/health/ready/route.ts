import { NextResponse } from 'next/server';
import { getDb } from '@video-factory/database';
import {
  isPlaceholderValue,
  isProductionRuntime,
  validateEnvSpecs,
  productionEnvSpecs,
} from '@video-factory/contracts';

export async function GET() {
  const checks: Record<string, string> = {
    web: 'ok',
    database: 'unknown',
    storage: 'unknown',
  };

  let allReady = true;

  // 1. Production environment validation — the service is NOT ready when
  //    required production configuration is missing or placeholder.
  if (isProductionRuntime()) {
    const envResult = validateEnvSpecs(productionEnvSpecs());
    checks.config = envResult.ok ? 'valid' : `invalid:${envResult.missing.concat(envResult.invalid).length}`;
    if (!envResult.ok) {
      allReady = false;
    }
  } else {
    checks.config = 'non_production';
  }

  // 2. Check Database connection
  try {
    const db = getDb();
    if (db) {
      checks.database = 'connected';
    }
  } catch (err: unknown) {
    checks.database = `error: ${(err as Error).message}`;
    allReady = false;
  }

  // 3. Check Storage Provider configuration (no silent mock in production)
  const r2Configured =
    !isPlaceholderValue(process.env.R2_ACCOUNT_ID) &&
    !isPlaceholderValue(process.env.R2_ACCESS_KEY_ID) &&
    !isPlaceholderValue(process.env.R2_SECRET_ACCESS_KEY) &&
    !isPlaceholderValue(process.env.R2_BUCKET_NAME);
  checks.storage = r2Configured ? 'r2_configured' : 'not_configured';
  if (isProductionRuntime() && !r2Configured) {
    allReady = false;
  }

  // 4. Render engine: report honest capability — a standalone Remotion engine
  //    is only "configured" when a serve URL or entry point exists.
  checks.renderEngine = process.env.REMOTION_SERVE_URL || process.env.REMOTION_ENTRY_POINT
    ? 'remotion_configured'
    : 'not_configured';
  if (isProductionRuntime() && checks.renderEngine === 'not_configured') {
    allReady = false;
  }

  // 5. Check Enabled Social Providers
  checks.socialProviders = [
    !isPlaceholderValue(process.env.GOOGLE_OAUTH_CLIENT_ID) ? 'youtube' : null,
    !isPlaceholderValue(process.env.META_APP_ID) ? 'instagram' : null,
    !isPlaceholderValue(process.env.TIKTOK_CLIENT_KEY) ? 'tiktok' : null,
  ].filter(Boolean).join(', ') || 'none_configured';

  return NextResponse.json(
    {
      status: allReady ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allReady ? 200 : 503 }
  );
}
