import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider, StorageProviderConfig } from './types';
import type { StoragePutOptions, StoragePutResult, PresignedUrlResult } from '@video-factory/contracts';

export class CloudflareR2Provider implements StorageProvider {
  public readonly name = 'r2';
  public readonly defaultBucket: string;
  private readonly client: S3Client;
  private readonly publicBaseUrl?: string;

  constructor(config?: StorageProviderConfig) {
    const accountId = config?.accountId || process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '';
    const endpoint =
      config?.endpoint ||
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : 'https://dummy-r2-endpoint.local');

    this.defaultBucket = config?.bucketName || process.env.R2_BUCKET_NAME || 'video-factory-media';
    this.publicBaseUrl = config?.publicBaseUrl || process.env.R2_PUBLIC_BASE_URL;

    this.client = new S3Client({
      region: config?.region || 'auto',
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || 'dummy-key',
        secretAccessKey: secretAccessKey || 'dummy-secret',
      },
    });
  }

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
      buffer = Buffer.from(body, 'utf-8');
    } else if (body instanceof Uint8Array) {
      buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    } else {
      // Readable stream
      const chunks: Uint8Array[] = [];
      const reader = (body as any).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      buffer = Buffer.concat(chunks);
    }

    // Calculate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        ...options?.metadata,
        checksum,
      },
    });

    await this.client.send(command);

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
    bucket?: string
  ): Promise<PresignedUrlResult> {
    const targetBucket = bucket || this.defaultBucket;
    const command = new GetObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      expiresInSeconds,
      objectKey: key,
    };
  }

  public async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = 900,
    bucket?: string
  ): Promise<PresignedUrlResult> {
    const targetBucket = bucket || this.defaultBucket;
    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      expiresInSeconds,
      objectKey: key,
    };
  }

  public async head(
    key: string,
    bucket?: string
  ): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string; checksum?: string }> {
    const targetBucket = bucket || this.defaultBucket;
    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      const res = await this.client.send(command);
      return {
        exists: true,
        sizeBytes: res.ContentLength,
        contentType: res.ContentType,
        checksum: res.Metadata?.checksum,
      };
    } catch {
      return { exists: false };
    }
  }

  public async delete(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket || this.defaultBucket;
    try {
      const command = new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}
