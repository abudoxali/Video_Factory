import { z } from 'zod';

export const SocialPlatformEnum = z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK']);
export type SocialPlatform = z.infer<typeof SocialPlatformEnum>;

export const SocialAccountStatusEnum = z.enum([
  'CONNECTED',
  'EXPIRED',
  'REVOKED',
  'ERROR',
  'DISCONNECTED',
]);
export type SocialAccountStatus = z.infer<typeof SocialAccountStatusEnum>;

export const SocialAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: SocialPlatformEnum,
  platformUserId: z.string(),
  platformUsername: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  status: SocialAccountStatusEnum.default('CONNECTED'),
  scopes: z.array(z.string()).default([]),
  tokenExpiresAt: z.coerce.date().optional().nullable(),
  refreshExpiresAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  connectedAt: z.coerce.date().default(() => new Date()),
  lastRefreshedAt: z.coerce.date().optional().nullable(),
  revokedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type SocialAccount = z.infer<typeof SocialAccountSchema>;

export const OAuthStatePayloadSchema = z.object({
  userId: z.string(),
  platform: SocialPlatformEnum,
  redirectUri: z.string().url(),
  nonce: z.string().min(16),
  codeVerifier: z.string().optional(),
  createdAt: z.number().int().positive(),
});
export type OAuthStatePayload = z.infer<typeof OAuthStatePayloadSchema>;

export const ArabicSocialPlatformMap: Record<SocialPlatform, string> = {
  YOUTUBE: 'يوتيوب (YouTube)',
  INSTAGRAM: 'إنستغرام (Instagram)',
  TIKTOK: 'تيك توك (TikTok)',
};

export const ArabicSocialAccountStatusMap: Record<SocialAccountStatus, string> = {
  CONNECTED: 'متصل وجاهز للنشر',
  EXPIRED: 'انتهت صلاحية الجلسة',
  REVOKED: 'تم إلغاء التصريح من المنصة',
  ERROR: 'خطأ في الاتصال',
  DISCONNECTED: 'غير متصل',
};

export function getArabicSocialPlatform(platform: string): string {
  const norm = platform.toUpperCase() as SocialPlatform;
  return ArabicSocialPlatformMap[norm] || platform;
}

export function getArabicSocialAccountStatus(status: string): string {
  const norm = status.toUpperCase() as SocialAccountStatus;
  return ArabicSocialAccountStatusMap[norm] || status;
}

export interface PlatformFeatureConfig {
  enabled: boolean;
  reasonDisabled?: string;
}

/**
 * Resolves platform availability based on launch scope feature flags
 */
export function getPlatformLaunchStatus(
  platform: SocialPlatform,
  envFlags?: {
    ENABLE_YOUTUBE?: string | boolean;
    ENABLE_INSTAGRAM?: string | boolean;
    ENABLE_TIKTOK?: string | boolean;
  }
): PlatformFeatureConfig {
  const flags = envFlags || {
    ENABLE_YOUTUBE: typeof process !== 'undefined' ? process.env?.ENABLE_YOUTUBE : true,
    ENABLE_INSTAGRAM: typeof process !== 'undefined' ? process.env?.ENABLE_INSTAGRAM : true,
    ENABLE_TIKTOK: typeof process !== 'undefined' ? process.env?.ENABLE_TIKTOK : true,
  };

  switch (platform) {
    case 'YOUTUBE': {
      const isExplicitlyDisabled = flags.ENABLE_YOUTUBE === 'false' || flags.ENABLE_YOUTUBE === false;
      if (isExplicitlyDisabled) {
        return { enabled: false, reasonDisabled: 'منصة يوتيوب معطلة حالياً عبر التكوين البرمجي للإطلاق' };
      }
      return { enabled: true };
    }
    case 'INSTAGRAM': {
      const isExplicitlyDisabled = flags.ENABLE_INSTAGRAM === 'false' || flags.ENABLE_INSTAGRAM === false;
      if (isExplicitlyDisabled) {
        return { enabled: false, reasonDisabled: 'منصة إنستغرام معطلة حالياً عبر التكوين البرمجي للإطلاق' };
      }
      return { enabled: true };
    }
    case 'TIKTOK': {
      const isExplicitlyDisabled = flags.ENABLE_TIKTOK === 'false' || flags.ENABLE_TIKTOK === false;
      if (isExplicitlyDisabled) {
        return { enabled: false, reasonDisabled: 'منصة تيك توك معطلة حالياً عبر التكوين البرمجي للإطلاق' };
      }
      return { enabled: true };
    }
  }
}

/**
 * Redacts secret token strings from logging or public outputs
 */
export function redactSensitiveString(val?: string | null): string {
  if (!val || typeof val !== 'string') return '***';
  if (val.length <= 8) return '***';
  return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
}

/**
 * Recursively redacts sensitive OAuth fields from any object
 */
export function redactSensitiveObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const sensitiveKeys = new Set([
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'client_secret',
    'clientSecret',
    'authorization',
    'password',
    'code_verifier',
    'codeVerifier',
    'access_token_encrypted',
    'refresh_token_encrypted',
  ]);

  const result: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = redactSensitiveObject(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
