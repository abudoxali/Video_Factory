import crypto from 'crypto';
import type { StorageProvider } from './types';
import type { StoragePutOptions, StoragePutResult, PresignedUrlResult } from '@video-factory/contracts';

export class MockStorageProvider implements StorageProvider {
  public readonly name = 'mock-storage';
  public readonly defaultBucket: string = 'mock-bucket';
  private storage = new Map<string, { buffer: Buffer; contentType: string; checksum: string }>();

  public async put(
    key: string,
    body: Buffer | Uint8Array | ReadableStream | string,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    const bucket = options?.bucket || this.defaultBucket;
    const contentType = options?.contentType || 'application/octet-stream';

    let buffer: Buffer;
    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (typeof body === 'string') {
      buffer = Buffer.from(body);
    } else if (body instanceof Uint8Array) {
      buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    } else {
      buffer = Buffer.from('mock-stream-data');
    }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    this.storage.set(key, { buffer, contentType, checksum });

    return {
      bucket,
      objectKey: key,
      sizeBytes: buffer.length,
      checksum,
      contentType,
    };
  }

  public async getSignedReadUrl(
    key: string,
    expiresInSeconds: number = 3600,
    _bucket?: string
  ): Promise<PresignedUrlResult> {
    return {
      url: `https://mock-r2.local/${key}?expires=${Date.now() + expiresInSeconds * 1000}&sig=mock_sig`,
      expiresInSeconds,
      objectKey: key,
    };
  }

  public async getSignedUploadUrl(
    key: string,
    _contentType: string,
    expiresInSeconds: number = 900,
    _bucket?: string
  ): Promise<PresignedUrlResult> {
    return {
      url: `https://mock-r2.local/upload/${key}?expires=${Date.now() + expiresInSeconds * 1000}&sig=mock_upload_sig`,
      expiresInSeconds,
      objectKey: key,
    };
  }

  public async head(
    key: string,
    _bucket?: string
  ): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string; checksum?: string }> {
    const item = this.storage.get(key);
    if (!item) return { exists: false };
    return {
      exists: true,
      sizeBytes: item.buffer.length,
      contentType: item.contentType,
      checksum: item.checksum,
    };
  }

  public async delete(key: string, _bucket?: string): Promise<boolean> {
    return this.storage.delete(key);
  }
}
