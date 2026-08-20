import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/video_factory'),
  N8N_VIDEO_FACTORY_WEBHOOK_URL: z
    .string()
    .url()
    .default('http://localhost:5678/webhook/vf-job-orchestrator'),
  N8N_VIDEO_FACTORY_WEBHOOK_SECRET: z
    .string()
    .default('dev_n8n_webhook_secret_change_in_prod'),
  VIDEO_FACTORY_N8N_CALLBACK_SECRET: z
    .string()
    .default('dev_callback_secret_change_me'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn('⚠️ Environment variable warning:', parsed.error.format());
    // In production we can choose to throw or provide safe defaults
    cachedEnv = envSchema.parse({});
  } else {
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}
