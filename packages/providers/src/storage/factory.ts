import type { StorageProvider, StorageProviderConfig } from './types';
import { CloudflareR2Provider } from './r2';
import { MockStorageProvider } from './mock';

export function createStorageProvider(
  providerName?: string,
  config?: StorageProviderConfig
): StorageProvider {
  const name = providerName || process.env.STORAGE_PROVIDER || 'r2';

  switch (name.toLowerCase()) {
    case 'r2':
    case 'cloudflare':
    case 's3':
      return new CloudflareR2Provider(config);
    case 'mock':
    case 'test':
      return new MockStorageProvider();
    default:
      return new CloudflareR2Provider(config);
  }
}
