import { NextResponse } from 'next/server';
import { getDb } from '@video-factory/database';

export async function GET() {
  const checks: Record<string, string> = {
    web: 'ok',
    database: 'unknown',
    storage: 'unknown',
    remotionEngine: 'configured',
  };

  let allReady = true;

  // 1. Check Database connection
  try {
    const db = getDb();
    if (db) {
      checks.database = 'connected';
    }
  } catch (err: unknown) {
    checks.database = `error: ${(err as Error).message}`;
    allReady = false;
  }

  // 2. Check Storage Provider configuration
  if (process.env.R2_BUCKET_NAME || process.env.R2_ACCOUNT_ID) {
    checks.storage = 'r2_configured';
  } else {
    checks.storage = 'mock_active';
  }

  // 3. Check Enabled Social Providers
  checks.socialProviders = [
    process.env.GOOGLE_OAUTH_CLIENT_ID ? 'youtube' : null,
    process.env.META_APP_ID ? 'instagram' : null,
    process.env.TIKTOK_CLIENT_KEY ? 'tiktok' : null,
  ].filter(Boolean).join(', ') || 'mock_mode';

  return NextResponse.json(
    {
      status: allReady ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allReady ? 200 : 503 }
  );
}
