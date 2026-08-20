import type {
  SocialPlatform,
  PublicationMetadata,
  PublicationStatus,
  PublicationErrorCode,
  PlatformCapabilities,
} from '@video-factory/contracts';

export interface OAuthAuthUrlRequest {
  userId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
  codeChallenge?: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  refreshExpiresInSeconds?: number | null;
  platformUserId: string;
  platformUsername?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  scopes: string[];
  rawResponse?: Record<string, unknown>;
}

export interface ValidateMediaRequest {
  videoBuffer?: Buffer;
  videoUrl?: string;
  sizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  mimeType: string;
  aspectRatio: string;
}

export interface MediaValidationResult {
  valid: boolean;
  errorCode?: PublicationErrorCode;
  errorMessage?: string;
  warnings?: string[];
}

export interface PublishMediaRequest {
  publicationId: string;
  videoId: string;
  renderId: string;
  userId: string;
  account: {
    id: string;
    platformUserId: string;
    accessToken: string;
    refreshToken?: string | null;
  };
  metadata: PublicationMetadata;
  video: {
    r2ObjectKey: string;
    r2Bucket?: string;
    videoUrl?: string;
    sizeBytes: number;
    durationSeconds: number;
    width: number;
    height: number;
    mimeType: string;
  };
  idempotencyKey: string;
}

export interface PublishSubmissionResult {
  success: boolean;
  status: PublicationStatus;
  platformPublicationId?: string | null;
  platformUrl?: string | null;
  providerRequestId?: string | null;
  errorCode?: PublicationErrorCode | null;
  errorMessage?: string | null;
  requiresReauth?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PublicationStatusRequest {
  publicationId: string;
  platformPublicationId: string;
  account: {
    accessToken: string;
    refreshToken?: string | null;
  };
  metadata?: Record<string, unknown>;
}

export interface PublicationStatusResult {
  status: PublicationStatus;
  platformUrl?: string | null;
  errorCode?: PublicationErrorCode | null;
  errorMessage?: string | null;
  rawStatus?: string;
}

export interface PublishingProvider {
  readonly platform: SocialPlatform;
  getCapabilities(): PlatformCapabilities;
  getAuthUrl(request: OAuthAuthUrlRequest): Promise<string>;
  exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResponse>;
  refreshTokens?(refreshToken: string): Promise<Partial<OAuthTokenResponse>>;
  validateMedia(request: ValidateMediaRequest): Promise<MediaValidationResult>;
  publish(request: PublishMediaRequest): Promise<PublishSubmissionResult>;
  getStatus(request: PublicationStatusRequest): Promise<PublicationStatusResult>;
}
