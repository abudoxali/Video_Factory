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

export class MockPublishingProvider implements PublishingProvider {
  public readonly platform: SocialPlatform;

  constructor(platform: SocialPlatform = 'YOUTUBE') {
    this.platform = platform;
  }

  public getCapabilities(): PlatformCapabilities {
    return PLATFORM_CAPABILITIES[this.platform];
  }

  public async getAuthUrl(request: OAuthAuthUrlRequest): Promise<string> {
    return `https://mock-${this.platform.toLowerCase()}.auth/authorize?state=${request.state}&redirect_uri=${encodeURIComponent(request.redirectUri)}`;
  }

  public async exchangeCodeForTokens(
    code: string,
    _redirectUri: string
  ): Promise<OAuthTokenResponse> {
    return {
      accessToken: `mock_${this.platform.toLowerCase()}_access_token_${code}`,
      refreshToken: `mock_${this.platform.toLowerCase()}_refresh_token_${code}`,
      expiresInSeconds: 3600,
      platformUserId: `mock_user_${Date.now()}`,
      platformUsername: `mock_${this.platform.toLowerCase()}_creator`,
      displayName: `Mock ${this.platform} Creator`,
      avatarUrl: `https://mock.cdn/${this.platform.toLowerCase()}-avatar.png`,
      scopes: ['publish', 'read'],
    };
  }

  public async refreshTokens(refreshToken: string): Promise<Partial<OAuthTokenResponse>> {
    return {
      accessToken: `mock_refreshed_access_token_${refreshToken.substring(0, 8)}`,
      expiresInSeconds: 3600,
    };
  }

  public async validateMedia(request: ValidateMediaRequest): Promise<MediaValidationResult> {
    const caps = this.getCapabilities();
    if (request.durationSeconds < caps.minDurationSeconds) {
      return {
        valid: false,
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: `مدة الفيديو أقل من الحد الأدنى (${caps.minDurationSeconds}s)`,
      };
    }
    return { valid: true };
  }

  public async publish(request: PublishMediaRequest): Promise<PublishSubmissionResult> {
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

    const mockId = `pub_${this.platform.toLowerCase()}_${Date.now()}`;
    const urlMap: Record<SocialPlatform, string> = {
      YOUTUBE: `https://youtu.be/${mockId}`,
      INSTAGRAM: `https://www.instagram.com/reel/${mockId}/`,
      TIKTOK: `https://www.tiktok.com/@mock/video/${mockId}`,
    };

    return {
      success: true,
      status: 'PUBLISHED',
      platformPublicationId: mockId,
      platformUrl: urlMap[this.platform],
      providerRequestId: `req_${mockId}`,
      metadata: { mock: true, platform: this.platform },
    };
  }

  public async getStatus(request: PublicationStatusRequest): Promise<PublicationStatusResult> {
    return {
      status: 'PUBLISHED',
      platformUrl: `https://mock-${this.platform.toLowerCase()}.com/${request.platformPublicationId}`,
    };
  }
}
