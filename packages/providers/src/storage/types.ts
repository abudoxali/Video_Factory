import type { StoragePutOptions, StoragePutResult, PresignedUrlResult } from '@video-factory/contracts';

export interface StorageProviderConfig {
  accountId?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  region?: string;
  publicBaseUrl?: string;
}

export interface StorageProvider {
  readonly name: string;
  readonly defaultBucket: string;

  put(
    key: string,
    body: Buffer | Uint8Array | ReadableStream | string,
    options?: StoragePutOptions
  ): Promise<StoragePutResult>;

  getSignedReadUrl(
    key: string,
    expiresInSeconds?: number,
    bucket?: string
  ): Promise<PresignedUrlResult>;

  getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
    bucket?: string
  ): Promise<PresignedUrlResult>;

  head(
    key: string,
    bucket?: string
  ): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string; checksum?: string }>;

  delete(key: string, bucket?: string): Promise<boolean>;
}
