/**
 * Production Environment Validation Boundary
 *
 * Single source of truth for runtime-environment decisions shared by the web
 * app, provider factories, and the database client. The production runtime
 * must fail closed: no silent dev defaults, no placeholder secrets, no
 * localhost fallbacks, and no mock providers.
 */

export class ProductionConfigError extends Error {
  public readonly missing: string[];
  public readonly invalid: string[];

  constructor(message: string, missing: string[] = [], invalid: string[] = []) {
    super(message);
    this.name = 'ProductionConfigError';
    this.missing = missing;
    this.invalid = invalid;
  }
}

/**
 * True when code is executing in a real production runtime.
 * Excludes the Next.js production build phase, where modules are loaded for
 * page-data collection but no live traffic is served and runtime env may not
 * be injected yet.
 */
export function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.NEXT_PHASE === 'phase-production-build') return false;
  return true;
}

/**
 * True inside automated test runners (vitest sets NODE_ENV=test).
 */
export function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test';
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^your[_-]/i,
  /^dummy[_-]/i,
  /change[_-]?(me|in[_-]?prod)/i,
  /^dev[_-]/i,
  /^test[_-]/i,
  /placeholder/i,
  /^xxx+$/i,
  /^changeme$/i,
  // Documented sample secrets (e.g. the dev fallback key) copied verbatim
  /^video_factory_(default|prod)_/i,
  // Documentation domains — never real production endpoints
  /example\.(com|org|net)/i,
  /your-domain\./i,
];

/**
 * Detects values that are present but obviously not real credentials.
 */
export function isPlaceholderValue(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  const v = value.trim();
  if (v.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(v));
}

/**
 * Detects localhost / loopback URLs which are never valid for external
 * production endpoints such as public app URLs or n8n webhooks.
 */
export function isLocalhostUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

export interface RequiredEnvSpec {
  name: string;
  /** When false, absence only downgrades the feature; caller decides. */
  required: boolean;
  /** Reject obvious placeholder strings. Default true in production checks. */
  rejectPlaceholder?: boolean;
  /** Reject localhost/loopback URLs. */
  rejectLocalhost?: boolean;
  /** Human-readable purpose for error messages. */
  purpose?: string;
}

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  invalid: string[];
  errors: string[];
}

/**
 * Validates a list of environment variable specs against process.env.
 * Never throws — returns a structured result so callers can aggregate.
 */
export function validateEnvSpecs(specs: RequiredEnvSpec[]): EnvValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const errors: string[] = [];

  for (const spec of specs) {
    const raw = process.env[spec.name];
    const present = raw !== undefined && raw.trim() !== '';
    const label = spec.purpose ? `${spec.name} (${spec.purpose})` : spec.name;

    if (!present) {
      if (spec.required) {
        missing.push(spec.name);
        errors.push(`Missing required production variable: ${label}`);
      }
      continue;
    }

    if (spec.rejectPlaceholder !== false && isPlaceholderValue(raw)) {
      invalid.push(spec.name);
      errors.push(`Placeholder value not allowed in production: ${label}`);
      continue;
    }

    if (spec.rejectLocalhost && isLocalhostUrl(raw)) {
      invalid.push(spec.name);
      errors.push(`Localhost URL not allowed in production: ${label}`);
    }
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, errors };
}

/**
 * Asserts a set of env specs; throws ProductionConfigError listing every
 * violation. Intended for production startup/runtime boundaries.
 */
export function assertEnvSpecs(specs: RequiredEnvSpec[], context?: string): void {
  const result = validateEnvSpecs(specs);
  if (!result.ok) {
    throw new ProductionConfigError(
      `${context ? `[${context}] ` : ''}Production configuration is invalid:\n - ${result.errors.join('\n - ')}`,
      result.missing,
      result.invalid
    );
  }
}

/**
 * Mock/simulated providers are never permitted in a production runtime.
 * Tests (NODE_ENV=test) may always use them; development may use them only
 * when explicitly requested through force flags or *_PROVIDER=mock env.
 */
export function assertMockProvidersAllowed(context: string): void {
  if (isProductionRuntime()) {
    throw new ProductionConfigError(
      `[${context}] Mock/simulated providers are not allowed in production. ` +
      `Configure real provider credentials or disable the feature.`
    );
  }
}

/**
 * Canonical production environment requirements for the whole platform.
 * Feature-gated groups are only enforced when their feature flag is enabled.
 */
export function productionEnvSpecs(): RequiredEnvSpec[] {
  const enabled = (name: string) => {
    const v = process.env[name];
    return v !== 'false' && v !== '0'; // enabled unless explicitly disabled
  };

  const specs: RequiredEnvSpec[] = [
    { name: 'DATABASE_URL', required: true, rejectPlaceholder: true, purpose: 'PostgreSQL connection' },
    {
      name: 'N8N_VIDEO_FACTORY_WEBHOOK_URL',
      required: true,
      rejectPlaceholder: true,
      rejectLocalhost: true,
      purpose: 'n8n orchestrator webhook',
    },
    {
      name: 'N8N_VIDEO_FACTORY_WEBHOOK_SECRET',
      required: true,
      rejectPlaceholder: true,
      purpose: 'n8n webhook shared secret',
    },
    {
      name: 'VIDEO_FACTORY_N8N_CALLBACK_SECRET',
      required: true,
      rejectPlaceholder: true,
      purpose: 'n8n callback authentication',
    },
    {
      name: 'SOCIAL_TOKEN_ENCRYPTION_KEY',
      required: true,
      rejectPlaceholder: true,
      purpose: 'AES-256-GCM social token encryption',
    },
    {
      name: 'VIDEO_FACTORY_SESSION_SECRET',
      required: true,
      rejectPlaceholder: true,
      purpose: 'signed session cookies',
    },
    {
      name: 'NEXT_PUBLIC_APP_URL',
      required: true,
      rejectPlaceholder: true,
      rejectLocalhost: true,
      purpose: 'public application URL',
    },
    // Cloudflare R2 object storage
    { name: 'R2_ACCOUNT_ID', required: true, rejectPlaceholder: true, purpose: 'R2 account' },
    { name: 'R2_ACCESS_KEY_ID', required: true, rejectPlaceholder: true, purpose: 'R2 access key' },
    {
      name: 'R2_SECRET_ACCESS_KEY',
      required: true,
      rejectPlaceholder: true,
      purpose: 'R2 secret key',
    },
    { name: 'R2_BUCKET_NAME', required: true, rejectPlaceholder: true, purpose: 'R2 bucket' },
    // AI media providers
    { name: 'GEMINI_API_KEY', required: true, rejectPlaceholder: true, purpose: 'Gemini/Google AI media' },
    {
      name: 'ELEVENLABS_API_KEY',
      required: true,
      rejectPlaceholder: true,
      purpose: 'ElevenLabs Arabic voiceover',
    },
  ];

  if (enabled('ENABLE_YOUTUBE')) {
    specs.push(
      {
        name: 'GOOGLE_OAUTH_CLIENT_ID',
        required: true,
        rejectPlaceholder: true,
        purpose: 'YouTube OAuth',
      },
      {
        name: 'GOOGLE_OAUTH_CLIENT_SECRET',
        required: true,
        rejectPlaceholder: true,
        purpose: 'YouTube OAuth',
      }
    );
  }
  if (enabled('ENABLE_INSTAGRAM')) {
    specs.push(
      { name: 'META_APP_ID', required: true, rejectPlaceholder: true, purpose: 'Meta/Instagram OAuth' },
      {
        name: 'META_APP_SECRET',
        required: true,
        rejectPlaceholder: true,
        purpose: 'Meta/Instagram OAuth',
      }
    );
  }
  if (enabled('ENABLE_TIKTOK')) {
    specs.push(
      {
        name: 'TIKTOK_CLIENT_KEY',
        required: true,
        rejectPlaceholder: true,
        purpose: 'TikTok OAuth',
      },
      {
        name: 'TIKTOK_CLIENT_SECRET',
        required: true,
        rejectPlaceholder: true,
        purpose: 'TikTok OAuth',
      }
    );
  }

  return specs;
}

/**
 * Full production configuration validation. Throws ProductionConfigError
 * when any required variable is missing, a placeholder, or a localhost URL.
 * Safe to call in any environment: it is a no-op outside production runtime.
 */
export function validateProductionEnvironment(context?: string): EnvValidationResult {
  if (!isProductionRuntime()) {
    return { ok: true, missing: [], invalid: [], errors: [] };
  }
  const result = validateEnvSpecs(productionEnvSpecs());
  if (!result.ok) {
    throw new ProductionConfigError(
      `${context ? `[${context}] ` : ''}Production environment validation failed:\n - ${result.errors.join('\n - ')}`,
      result.missing,
      result.invalid
    );
  }
  return result;
}
