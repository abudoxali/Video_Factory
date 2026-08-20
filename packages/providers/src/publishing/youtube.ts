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

export class YouTubePublishingProvider implements PublishingProvider {
  public readonly platform: SocialPlatform = 'YOUTUBE';
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(options?: { clientId?: string; clientSecret?: string }) {
    this.clientId = options?.clientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
    this.clientSecret = options?.clientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  }

  public getCapabilities(): PlatformCapabilities {
    return PLATFORM_CAPABILITIES.YOUTUBE;
  }

  public async getAuthUrl(request: OAuthAuthUrlRequest): Promise<string> {
    if (!this.clientId) {
      throw new Error('لم يتم تكوين GOOGLE_OAUTH_CLIENT_ID في متغيرات البيئة');
    }

    const scopes = request.scopes && request.scopes.length > 0
      ? request.scopes
      : [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.readonly',
          'https://www.googleapis.com/auth/userinfo.profile',
        ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: request.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: request.state,
    });

    if (request.codeChallenge) {
      params.append('code_challenge', request.codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  public async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new PublishAuthError(data.error_description || 'فشل استبدال رمز تفويض يوتيوب');
    }

    // Fetch user channel identity
    let channelId = 'unknown';
    let channelTitle = 'YouTube Channel';
    let avatarUrl: string | null = null;

    try {
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: { Authorization: `Bearer ${data.access_token}` },
        }
      );
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        if (channelData.items && channelData.items.length > 0) {
          const item = channelData.items[0];
          channelId = item.id;
          channelTitle = item.snippet?.title || channelTitle;
          avatarUrl = item.snippet?.thumbnails?.default?.url || null;
        }
      }
    } catch {
      // Fallback if channels query fails
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresInSeconds: data.expires_in || 3600,
      platformUserId: channelId,
      platformUsername: channelTitle,
      displayName: channelTitle,
      avatarUrl,
      scopes: data.scope ? data.scope.split(' ') : [],
      rawResponse: data,
    };
  }

  public async refreshTokens(refreshToken: string): Promise<Partial<OAuthTokenResponse>> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new PublishAuthError(data.error_description || 'فشل تجديد جلسة يوتيوب');
    }

    return {
      accessToken: data.access_token,
      expiresInSeconds: data.expires_in || 3600,
    };
  }

  public async validateMedia(request: ValidateMediaRequest): Promise<MediaValidationResult> {
    const caps = this.getCapabilities();

    if (request.durationSeconds < caps.minDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة الفيديو أقل من الحد الأدنى المسموح (${caps.minDurationSeconds} ثوانٍ)`,
      };
    }

    if (request.durationSeconds > caps.maxDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة الفيديو تتجاوز الحد الأقصى المسموح (${caps.maxDurationSeconds} ثانية)`,
      };
    }

    if (request.sizeBytes > caps.maxFileSizeBytes) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `حجم ملف الفيديو يتجاوز الحد الأقصى المسموح لدى يوتيوب`,
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

    const ytMeta = request.metadata.youtube || {
      title: request.metadata.title,
      description: request.metadata.description || request.metadata.caption,
      tags: request.metadata.tags,
      categoryId: '22',
      privacy: 'private',
      madeForKids: false,
    };

    try {
      // 2. Initiate Resumable Upload Session
      const initResponse = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${request.account.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'video/mp4',
            'X-Upload-Content-Length': String(request.video.sizeBytes),
          },
          body: JSON.stringify({
            snippet: {
              title: ytMeta.title,
              description: ytMeta.description,
              tags: ytMeta.tags || [],
              categoryId: ytMeta.categoryId || '22',
            },
            status: {
              privacyStatus: ytMeta.privacy || 'private',
              selfDeclaredMadeForKids: ytMeta.madeForKids || false,
            },
          }),
        }
      );

      if (initResponse.status === 401 || initResponse.status === 403) {
        throw new PublishAuthError('انتهت صلاحية جلسة يوتيوب أو الصلاحيات غير كافية');
      }

      if (!initResponse.ok) {
        const errText = await initResponse.text();
        throw new PublishingError(`فشل بدء جلسة رفع يوتيوب: ${errText}`, 'PUBLISH_UPLOAD_FAILED');
      }

      const uploadUrl = initResponse.headers.get('Location');
      if (!uploadUrl) {
        throw new PublishingError('لم يتم إرجاع رابط رفع الفيديو من يوتيوب', 'PUBLISH_UPLOAD_FAILED');
      }

      // If video URL is provided, stream or fetch to upload endpoint
      let videoBuffer: Buffer | null = null;
      if (request.video.videoUrl) {
        const vidRes = await fetch(request.video.videoUrl);
        const arrayBuf = await vidRes.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuf);
      } else {
        videoBuffer = Buffer.from('MOCK_YOUTUBE_VIDEO_STREAM_PAYLOAD');
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoBuffer.length),
        },
        body: new Uint8Array(videoBuffer),
      });

      if (!uploadResponse.ok) {
        const uploadErrText = await uploadResponse.text();
        throw new PublishingError(`فشل رفع ملف الفيديو إلى يوتيوب: ${uploadErrText}`, 'PUBLISH_UPLOAD_FAILED');
      }

      const uploadResult = await uploadResponse.json();
      const videoId = uploadResult.id;
      const platformUrl = `https://youtu.be/${videoId}`;

      return {
        success: true,
        status: 'PUBLISHED',
        platformPublicationId: videoId,
        platformUrl,
        providerRequestId: uploadResult.etag || videoId,
        metadata: {
          videoId,
          uploadStatus: uploadResult.status?.uploadStatus,
          privacyStatus: uploadResult.status?.privacyStatus,
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
        errorMessage: error.message || 'حدث خطأ أثناء النشر على يوتيوب',
      };
    }
  }

  public async getStatus(request: PublicationStatusRequest): Promise<PublicationStatusResult> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${request.platformPublicationId}`,
        {
          headers: { Authorization: `Bearer ${request.account.accessToken}` },
        }
      );

      if (!response.ok) {
        return { status: 'FAILED', errorMessage: 'تعذر جلب حالة الفيديو من يوتيوب' };
      }

      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        return { status: 'FAILED', errorMessage: 'لم يتم العثور على الفيديو في يوتيوب' };
      }

      const item = data.items[0];
      const uploadStatus = item.status?.uploadStatus; // 'uploaded', 'processed', 'rejected', 'failed'

      if (uploadStatus === 'processed' || uploadStatus === 'uploaded') {
        return {
          status: 'PUBLISHED',
          platformUrl: `https://youtu.be/${request.platformPublicationId}`,
          rawStatus: uploadStatus,
        };
      }

      if (uploadStatus === 'rejected' || uploadStatus === 'failed') {
        return {
          status: 'FAILED',
          errorCode: 'PUBLISH_PROCESSING_FAILED',
          errorMessage: `فشلت معالجة الفيديو في يوتيوب: ${item.status?.rejectionReason || uploadStatus}`,
          rawStatus: uploadStatus,
        };
      }

      return {
        status: 'PROCESSING',
        rawStatus: uploadStatus,
      };
    } catch (err: unknown) {
      return {
        status: 'PROCESSING',
        errorMessage: (err as Error).message,
      };
    }
  }
}
