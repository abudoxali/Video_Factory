import { z } from 'zod';
import {
  isLocalhostUrl,
  isPlaceholderValue,
  validateProductionEnvironment,
  ProductionConfigError,
} from '@video-factory/contracts';

/**
 * Web runtime environment boundary.
 *
 * - development / test: safe localhost defaults are applied automatically.
 * - production runtime: any missing, placeholder, or inappropriate localhost
 *   value produces a hard ProductionConfigError — the app fails closed
 *   instead of silently operating on development defaults.
 */

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  N8N_VIDEO_FACTORY_WEBHOOK_URL: z.string().url().optional(),
  N8N_VIDEO_FACTORY_WEBHOOK_SECRET: z.string().optional(),
  VIDEO_FACTORY_N8N_CALLBACK_SECRET: z.string().optional(),
  VIDEO_FACTORY_SESSION_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export interface Env {
  DATABASE_URL: string;
  N8N_VIDEO_FACTORY_WEBHOOK_URL: string;
  N8N_VIDEO_FACTORY_WEBHOOK_SECRET: string;
  VIDEO_FACTORY_N8N_CALLBACK_SECRET: string;
  VIDEO_FACTORY_SESSION_SECRET: string;
  NODE_ENV: 'development' | 'test' | 'production';
  NEXT_PUBLIC_APP_URL: string;
}

const DEV_DEFAULTS: Env = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/video_factory',
  N8N_VIDEO_FACTORY_WEBHOOK_URL: 'http://localhost:5678/webhook/vf-job-orchestrator',
  N8N_VIDEO_FACTORY_WEBHOOK_SECRET: 'dev_n8n_webhook_secret_change_in_prod',
  VIDEO_FACTORY_N8N_CALLBACK_SECRET: 'dev_callback_secret_change_me',
  VIDEO_FACTORY_SESSION_SECRET: 'dev_session_secret_change_me',
  NODE_ENV: 'development',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};

const REQUIRED_IN_PROD: Array<keyof Env> = [
  'DATABASE_URL',
  'N8N_VIDEO_FACTORY_WEBHOOK_URL',
  'N8N_VIDEO_FACTORY_WEBHOOK_SECRET',
  'VIDEO_FACTORY_N8N_CALLBACK_SECRET',
  'VIDEO_FACTORY_SESSION_SECRET',
  'NEXT_PUBLIC_APP_URL',
];

const NO_LOCALHOST_IN_PROD: Array<keyof Env> = [
  'N8N_VIDEO_FACTORY_WEBHOOK_URL',
  'NEXT_PUBLIC_APP_URL',
];

function isProdRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  );
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  const raw: z.infer<typeof envSchema> = parsed.success ? parsed.data : envSchema.parse({});

  if (isProdRuntime()) {
    const errors: string[] = [];

    for (const key of REQUIRED_IN_PROD) {
      const value = raw[key];
      if (isPlaceholderValue(value)) {
        errors.push(`${key} is missing or a placeholder`);
      } else if (NO_LOCALHOST_IN_PROD.includes(key) && isLocalhostUrl(value)) {
        errors.push(`${key} must not be a localhost URL in production`);
      }
    }

    if (errors.length > 0) {
      throw new ProductionConfigError(
        `Web production environment validation failed:\n - ${errors.join('\n - ')}`,
        errors.map((e) => e.split(' ')[0])
      );
    }

    cachedEnv = {
      DATABASE_URL: raw.DATABASE_URL!,
      N8N_VIDEO_FACTORY_WEBHOOK_URL: raw.N8N_VIDEO_FACTORY_WEBHOOK_URL!,
      N8N_VIDEO_FACTORY_WEBHOOK_SECRET: raw.N8N_VIDEO_FACTORY_WEBHOOK_SECRET!,
      VIDEO_FACTORY_N8N_CALLBACK_SECRET: raw.VIDEO_FACTORY_N8N_CALLBACK_SECRET!,
      VIDEO_FACTORY_SESSION_SECRET: raw.VIDEO_FACTORY_SESSION_SECRET!,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: raw.NEXT_PUBLIC_APP_URL!,
    };
    return cachedEnv;
  }

  cachedEnv = {
    DATABASE_URL: raw.DATABASE_URL || DEV_DEFAULTS.DATABASE_URL,
    N8N_VIDEO_FACTORY_WEBHOOK_URL:
      raw.N8N_VIDEO_FACTORY_WEBHOOK_URL || DEV_DEFAULTS.N8N_VIDEO_FACTORY_WEBHOOK_URL,
    N8N_VIDEO_FACTORY_WEBHOOK_SECRET:
      raw.N8N_VIDEO_FACTORY_WEBHOOK_SECRET || DEV_DEFAULTS.N8N_VIDEO_FACTORY_WEBHOOK_SECRET,
    VIDEO_FACTORY_N8N_CALLBACK_SECRET:
      raw.VIDEO_FACTORY_N8N_CALLBACK_SECRET || DEV_DEFAULTS.VIDEO_FACTORY_N8N_CALLBACK_SECRET,
    VIDEO_FACTORY_SESSION_SECRET:
      raw.VIDEO_FACTORY_SESSION_SECRET || DEV_DEFAULTS.VIDEO_FACTORY_SESSION_SECRET,
    NODE_ENV: raw.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_URL: raw.NEXT_PUBLIC_APP_URL || DEV_DEFAULTS.NEXT_PUBLIC_APP_URL,
  };
  return cachedEnv;
}

/**
 * Full platform production validation — invoked once at server startup via
 * instrumentation.ts and reported by the readiness endpoint.
 */
export function assertWebProductionEnv(): void {
  validateProductionEnvironment('web');
}

/** Test-only helper to reset the cached environment between assertions. */
export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
