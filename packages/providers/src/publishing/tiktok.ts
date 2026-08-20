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

export class TikTokPublishingProvider implements PublishingProvider {
  public readonly platform: SocialPlatform = 'TIKTOK';
  private readonly clientKey: string;
  private readonly clientSecret: string;

  constructor(options?: { clientKey?: string; clientSecret?: string }) {
    this.clientKey = options?.clientKey || process.env.TIKTOK_CLIENT_KEY || '';
    this.clientSecret = options?.clientSecret || process.env.TIKTOK_CLIENT_SECRET || '';
  }

  public getCapabilities(): PlatformCapabilities {
    return PLATFORM_CAPABILITIES.TIKTOK;
  }

  public async getAuthUrl(request: OAuthAuthUrlRequest): Promise<string> {
    if (!this.clientKey) {
      throw new Error('لم يتم تكوين TIKTOK_CLIENT_KEY في متغيرات البيئة');
    }

    const scopes = request.scopes && request.scopes.length > 0
      ? request.scopes
      : ['user.info.basic', 'video.publish', 'video.upload'];

    const params = new URLSearchParams({
      client_key: this.clientKey,
      redirect_uri: request.redirectUri,
      response_type: 'code',
      scope: scopes.join(','),
      state: request.state,
    });

    if (request.codeChallenge) {
      params.append('code_challenge', request.codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  public async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok || data.error || data.message !== 'success') {
      throw new PublishAuthError(data.error_description || data.message || 'فشل استبدال رمز تفويض تيك توك');
    }

    const tokenData = data.data || data;

    // Retrieve user basic profile
    let openId = tokenData.open_id || 'unknown';
    let username = 'TikTok Creator';
    let avatarUrl: string | null = null;

    try {
      const userRes = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.data?.user) {
          openId = userData.data.user.open_id || openId;
          username = userData.data.user.display_name || username;
          avatarUrl = userData.data.user.avatar_url || null;
        }
      }
    } catch {
      // Fallback
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresInSeconds: tokenData.expires_in || 86400,
      refreshExpiresInSeconds: tokenData.refresh_expires_in || 31536000,
      platformUserId: openId,
      platformUsername: username,
      displayName: username,
      avatarUrl,
      scopes: tokenData.scope ? tokenData.scope.split(',') : [],
      rawResponse: data,
    };
  }

  public async refreshTokens(refreshToken: string): Promise<Partial<OAuthTokenResponse>> {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new PublishAuthError(data.error_description || 'فشل تجديد جلسة تيك توك');
    }

    const tokenData = data.data || data;
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresInSeconds: tokenData.expires_in || 86400,
    };
  }

  public async validateMedia(request: ValidateMediaRequest): Promise<MediaValidationResult> {
    const caps = this.getCapabilities();

    if (request.durationSeconds < caps.minDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة فيديو تيك توك يجب ألا تقل عن ${caps.minDurationSeconds} ثوانٍ`,
      };
    }

    if (request.durationSeconds > caps.maxDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة فيديو تيك توك تتجاوز الحد الأقصى (${caps.maxDurationSeconds} ثانية / 10 دقائق)`,
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

    const ttMeta = request.metadata.tiktok || {
      caption: request.metadata.caption || request.metadata.title,
      privacy: 'SELF_ONLY',
      allowComments: true,
      allowDuet: true,
      allowStitch: true,
      brandContentToggle: false,
      brandOrganicToggle: false,
    };

    try {
      // 2. Initialize Direct Post with FILE_UPLOAD
      const initPayload = {
        post_info: {
          title: ttMeta.caption,
          privacy_level: ttMeta.privacy || 'SELF_ONLY',
          disable_duet: !ttMeta.allowDuet,
          disable_stitch: !ttMeta.allowStitch,
          disable_comment: !ttMeta.allowComments,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: request.video.sizeBytes,
          chunk_size: request.video.sizeBytes,
          total_chunk_count: 1,
        },
      };

      const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${request.account.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(initPayload),
      });

      const initData = await initRes.json();
      if (!initRes.ok || initData.error?.code !== 'ok') {
        if (initData.error?.code === 'access_token_invalid') {
          throw new PublishAuthError('انتهت صلاحية جلسة تيك توك أو التصريح غير صالح');
        }
        throw new PublishingError(
          `فشل بدء عملية النشر على تيك توك: ${initData.error?.message || 'خطأ في الاستجابة'}`,
          'PUBLISH_UPLOAD_FAILED'
        );
      }

      const publishId = initData.data?.publish_id;
      const uploadUrl = initData.data?.upload_url;

      if (!publishId || !uploadUrl) {
        throw new PublishingError('لم يتم إرجاع رابط الرفع من تيك توك', 'PUBLISH_UPLOAD_FAILED');
      }

      // 3. Upload File Chunk to TikTok Upload URL
      let videoBuffer: Buffer | null = null;
      if (request.video.videoUrl) {
        const vidRes = await fetch(request.video.videoUrl);
        const arrayBuf = await vidRes.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuf);
      } else {
        videoBuffer = Buffer.from('MOCK_TIKTOK_VIDEO_STREAM_PAYLOAD');
      }

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoBuffer.length),
          'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
        },
        body: new Uint8Array(videoBuffer),
      });

      if (!uploadRes.ok) {
        throw new PublishingError('فشل رفع كتلة الفيديو إلى تيك توك', 'PUBLISH_UPLOAD_FAILED');
      }

      return {
        success: true,
        status: 'PROCESSING',
        platformPublicationId: publishId,
        providerRequestId: publishId,
        metadata: {
          publishId,
          privacyLevel: ttMeta.privacy,
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
        errorMessage: error.message || 'حدث خطأ أثناء النشر على تيك توك',
      };
    }
  }

  public async getStatus(request: PublicationStatusRequest): Promise<PublicationStatusResult> {
    try {
      const publishId = (request.metadata?.publishId as string) || request.platformPublicationId;
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${request.account.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id: publishId }),
      });

      if (!res.ok) {
        return { status: 'FAILED', errorMessage: 'تعذر جلب حالة المنشور من تيك توك' };
      }

      const data = await res.json();
      const status = data.data?.status; // 'PUBLISH_COMPLETE', 'PROCESSING_UPLOAD', 'FAILED'

      if (status === 'PUBLISH_COMPLETE') {
        const shareUrl = data.data?.publicaly_available_post_id
          ? `https://www.tiktok.com/@creator/video/${data.data.publicaly_available_post_id[0]}`
          : undefined;

        return {
          status: 'PUBLISHED',
          platformUrl: shareUrl,
          rawStatus: status,
        };
      }

      if (status === 'FAILED') {
        return {
          status: 'FAILED',
          errorCode: 'PUBLISH_PROCESSING_FAILED',
          errorMessage: `فشلت معالجة منشور تيك توك: ${data.data?.fail_reason || 'خطأ في المعالجة'}`,
          rawStatus: status,
        };
      }

      return {
        status: 'PROCESSING',
        rawStatus: status,
      };
    } catch (err: unknown) {
      return {
        status: 'PROCESSING',
        errorMessage: (err as Error).message,
      };
    }
  }
}
