import {
  PLATFORM_CAPABILITIES,
  type PlatformCapabilities,
  type SocialPlatform,
} from '@video-factory/contracts';
import type {
  PublishingProvider,
  OAuthAuthUrlRequest,
  OAuthTokenResponse,
  ValidateMediaRequest,
  MediaValidationResult,
  PublishMediaRequest,
  PublishSubmissionResult,
  PublicationStatusRequest,
  PublicationStatusResult,
} from './types';
import { PublishingError, PublishAuthError } from './errors';

export class InstagramPublishingProvider implements PublishingProvider {
  public readonly platform: SocialPlatform = 'INSTAGRAM';
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly apiVersion: string;

  constructor(options?: { appId?: string; appSecret?: string; apiVersion?: string }) {
    this.appId = options?.appId || process.env.META_APP_ID || '';
    this.appSecret = options?.appSecret || process.env.META_APP_SECRET || '';
    this.apiVersion = options?.apiVersion || process.env.META_GRAPH_API_VERSION || 'v22.0';
  }

  public getCapabilities(): PlatformCapabilities {
    return PLATFORM_CAPABILITIES.INSTAGRAM;
  }

  public async getAuthUrl(request: OAuthAuthUrlRequest): Promise<string> {
    if (!this.appId) {
      throw new Error('لم يتم تكوين META_APP_ID في متغيرات البيئة');
    }

    const scopes = request.scopes && request.scopes.length > 0
      ? request.scopes
      : [
          'instagram_basic',
          'instagram_content_publish',
          'pages_show_list',
          'pages_read_engagement',
          'business_management',
        ];

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: request.redirectUri,
      response_type: 'code',
      scope: scopes.join(','),
      state: request.state,
    });

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
  }

  public async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse> {
    // 1. Exchange short-lived token
    const tokenUrl = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token?client_id=${this.appId}&client_secret=${this.appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      throw new PublishAuthError(tokenData.error?.message || 'فشل استبدال رمز تفويض فيسبوك/إنستغرام');
    }

    const shortToken = tokenData.access_token;

    // 2. Exchange for long-lived token (60 days)
    const longTokenUrl = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.appId}&client_secret=${this.appSecret}&fb_exchange_token=${shortToken}`;
    const longRes = await fetch(longTokenUrl);
    const longData = await longRes.json();
    const accessToken = longData.access_token || shortToken;
    const expiresInSeconds = longData.expires_in || 5184000; // 60 days

    // 3. Find Connected Instagram Business Account ID
    const pagesUrl = `https://graph.facebook.com/${this.apiVersion}/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    let igAccountId = 'unknown';
    let igUsername = 'Instagram Account';
    let avatarUrl: string | null = null;

    if (pagesData.data && Array.isArray(pagesData.data)) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          igAccountId = page.instagram_business_account.id;
          igUsername = page.instagram_business_account.username || page.name;
          avatarUrl = page.instagram_business_account.profile_picture_url || null;
          break;
        }
      }
    }

    return {
      accessToken,
      refreshToken: null,
      expiresInSeconds,
      platformUserId: igAccountId,
      platformUsername: igUsername,
      displayName: igUsername,
      avatarUrl,
      scopes: ['instagram_basic', 'instagram_content_publish'],
      rawResponse: pagesData,
    };
  }

  public async validateMedia(request: ValidateMediaRequest): Promise<MediaValidationResult> {
    const caps = this.getCapabilities();

    if (request.durationSeconds < caps.minDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة مقطع ريلز إنستغرام يجب ألا تقل عن ${caps.minDurationSeconds} ثوانٍ`,
      };
    }

    if (request.durationSeconds > caps.maxDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة مقطع ريلز إنستغرام تتجاوز الحد الأقصى (${caps.maxDurationSeconds} ثانية / 15 دقيقة)`,
      };
    }

    return { valid: true };
  }

  public async publish(request: PublishMediaRequest): Promise<PublishSubmissionResult> {
    // 1. Validate Media
    const validation = await this.validateMedia({
      sizeBytes: request.video.sizeBytes,
      durationSeconds: request.video.durationSeconds,
      width: request.video.width,
      height: request.video.height,
      fps: 30,
      mimeType: request.video.mimeType,
      aspectRatio: '9:16',
    });

    if (!validation.valid) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: validation.errorCode,
        errorMessage: validation.errorMessage,
      };
    }

    if (!request.video.videoUrl) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: 'يتطلب النشر على إنستغرام رابط فيديو موقع ومتاح للاستيراد السحابي',
      };
    }

    const caption = request.metadata.instagram?.caption || request.metadata.caption || request.metadata.title;
    const igUserId = request.account.platformUserId;

    try {
      // 2. Step 1: Create Media Container for Reels
      const containerParams = new URLSearchParams({
        media_type: 'REELS',
        video_url: request.video.videoUrl,
        caption: caption,
        share_to_feed: String(request.metadata.instagram?.shareToFeed ?? true),
        access_token: request.account.accessToken,
      });

      const containerRes = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${igUserId}/media`,
        {
          method: 'POST',
          body: containerParams,
        }
      );

      const containerData = await containerRes.json();
      if (!containerRes.ok || containerData.error) {
        if (containerData.error?.code === 190) {
          throw new PublishAuthError('انتهت صلاحية جلسة إنستغرام أو الحساب غير مخول');
        }
        throw new PublishingError(
          `فشل إنشاء حاوية وسائط إنستغرام ريلز: ${containerData.error?.message || 'خطأ غير معروف'}`,
          'PUBLISH_UPLOAD_FAILED'
        );
      }

      const containerId = containerData.id;

      // 3. Step 2: Publish Media Container
      const publishParams = new URLSearchParams({
        creation_id: containerId,
        access_token: request.account.accessToken,
      });

      const pubRes = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${igUserId}/media_publish`,
        {
          method: 'POST',
          body: publishParams,
        }
      );

      const pubData = await pubRes.json();
      if (!pubRes.ok || pubData.error) {
        // Container might still be processing asynchronously
        return {
          success: true,
          status: 'PROCESSING',
          platformPublicationId: containerId,
          providerRequestId: containerId,
          metadata: {
            containerId,
            status: 'IN_PROGRESS',
          },
        };
      }

      const mediaId = pubData.id;
      return {
        success: true,
        status: 'PUBLISHED',
        platformPublicationId: mediaId,
        platformUrl: `https://www.instagram.com/reel/${mediaId}/`,
        providerRequestId: mediaId,
        metadata: {
          containerId,
          mediaId,
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      if (error instanceof PublishAuthError) {
        return {
          success: false,
          status: 'REQUIRES_REAUTH',
          errorCode: 'PUBLISH_AUTH_REQUIRED',
          errorMessage: error.message,
          requiresReauth: true,
        };
      }

      return {
        success: false,
        status: 'FAILED',
        errorCode: 'PUBLISH_PROVIDER_ERROR',
        errorMessage: error.message || 'حدث خطأ أثناء النشر على إنستغرام',
      };
    }
  }

  public async getStatus(request: PublicationStatusRequest): Promise<PublicationStatusResult> {
    try {
      const containerId = (request.metadata?.containerId as string) || request.platformPublicationId;
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${containerId}?fields=status_code,status&access_token=${request.account.accessToken}`
      );

      if (!res.ok) {
        return { status: 'FAILED', errorMessage: 'تعذر جلب حالة الحاوية من إنستغرام' };
      }

      const data = await res.json();
      const statusCode = data.status_code; // 'FINISHED', 'IN_PROGRESS', 'ERROR', 'EXPIRED'

      if (statusCode === 'FINISHED') {
        return {
          status: 'PUBLISHED',
          platformUrl: `https://www.instagram.com/reel/${request.platformPublicationId}/`,
          rawStatus: statusCode,
        };
      }

      if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        return {
          status: 'FAILED',
          errorCode: 'PUBLISH_PROCESSING_FAILED',
          errorMessage: `فشلت معالجة حاوية إنستغرام: ${data.status || statusCode}`,
          rawStatus: statusCode,
        };
      }

      return {
        status: 'PROCESSING',
        rawStatus: statusCode,
      };
    } catch (err: unknown) {
      return {
        status: 'PROCESSING',
        errorMessage: (err as Error).message,
      };
    }
  }
}
