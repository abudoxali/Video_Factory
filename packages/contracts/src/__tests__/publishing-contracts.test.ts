import { describe, it, expect } from 'vitest';
import {
  PublicationMetadataSchema,
  ArabicSocialPlatformMap,
  ArabicSocialAccountStatusMap,
  ArabicPublicationStatusMap,
  getArabicSocialPlatform,
  getArabicPublicationStatus,
  redactSensitiveObject,
} from '../index';

describe('Phase 05 Publishing Contracts & Arabic Maps', () => {
  it('validates PublicationMetadataSchema with partial platform configs', () => {
    const validData = {
      title: 'فيديو رائع عن الذكاء الاصطناعي',
      caption: 'شاهد أقوى تقنيات الذكاء الاصطناعي',
      description: 'وصف تفصيلي للفيديو',
      tags: ['ذكاء_اصطناعي', 'تقنية'],
      hashtags: ['#ai', '#tech'],
      privacy: 'public',
      youtube: {
        title: 'فيديو يوتيوب',
        description: 'وصف يوتيوب كامل',
        tags: ['ai'],
        categoryId: '22',
        privacy: 'public' as const,
        madeForKids: false,
      },
    };

    const parsed = PublicationMetadataSchema.parse(validData);
    expect(parsed.title).toBe(validData.title);
    expect(parsed.youtube?.categoryId).toBe('22');
  });

  it('maps Arabic platform names and statuses correctly', () => {
    expect(getArabicSocialPlatform('YOUTUBE')).toBe(ArabicSocialPlatformMap.YOUTUBE);
    expect(getArabicSocialPlatform('INSTAGRAM')).toBe(ArabicSocialPlatformMap.INSTAGRAM);
    expect(getArabicSocialPlatform('TIKTOK')).toBe(ArabicSocialPlatformMap.TIKTOK);

    expect(getArabicPublicationStatus('PUBLISHED')).toBe('تم النشر بنجاح');
    expect(getArabicPublicationStatus('QUEUED')).toBe('في قائمة النشر');
  });

  it('redacts sensitive OAuth keys recursively from objects', () => {
    const sensitiveObj = {
      userId: 'usr_123',
      access_token: 'secret_live_access_token_value',
      refreshToken: 'secret_live_refresh_token_value',
      nested: {
        clientSecret: 'super_secret',
        regularField: 'safe_value',
      },
    };

    const redacted = redactSensitiveObject(sensitiveObj);

    expect(redacted.userId).toBe('usr_123');
    expect(redacted.access_token).toBe('[REDACTED]');
    expect(redacted.refreshToken).toBe('[REDACTED]');
    expect(redacted.nested.clientSecret).toBe('[REDACTED]');
    expect(redacted.nested.regularField).toBe('safe_value');
  });
});
