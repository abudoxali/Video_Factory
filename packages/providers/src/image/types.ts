import type { ImageGenerationRequest, ImageGenerationResult } from '@video-factory/contracts';

export interface ImageProviderConfig {
  apiKey?: string;
  defaultModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ImageProvider {
  readonly name: string;
  readonly defaultModel: string;

  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
