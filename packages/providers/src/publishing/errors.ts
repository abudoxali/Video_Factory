import type { PublicationErrorCode } from '@video-factory/contracts';

export class PublishingError extends Error {
  public readonly code: PublicationErrorCode;
  public readonly isRetryable: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: PublicationErrorCode = 'PUBLISH_PROVIDER_ERROR',
    isRetryable = false,
    details?: unknown
  ) {
    super(message);
    this.name = 'PublishingError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.details = details;
  }
}

export class PublishAuthError extends PublishingError {
  constructor(message = 'فشل التحقق من صلاحيات حساب المنصة أو انتهت صلاحية الجلسة') {
    super(message, 'PUBLISH_AUTH_REQUIRED', false);
    this.name = 'PublishAuthError';
  }
}

export class PublishRateLimitError extends PublishingError {
  constructor(message = 'تم تجاوز حدود النشر المسموحة لدى المنصة (Rate Limit)') {
    super(message, 'PUBLISH_RATE_LIMIT', true);
    this.name = 'PublishRateLimitError';
  }
}

export class PublishMediaInvalidError extends PublishingError {
  constructor(message: string) {
    super(message, 'PUBLISH_INVALID_MEDIA', false);
    this.name = 'PublishMediaInvalidError';
  }
}

export class PublishConfigError extends PublishingError {
  constructor(message: string) {
    super(message, 'PUBLISH_NOT_CONFIGURED', false);
    this.name = 'PublishConfigError';
  }
}
