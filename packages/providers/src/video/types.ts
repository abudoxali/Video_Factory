import type {
  VideoGenerationRequest,
  VideoGenerationSubmission,
  VideoGenerationStatus,
} from '@video-factory/contracts';

export interface VideoProviderConfig {
  apiKey?: string;
  defaultModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface VideoProvider {
  readonly name: string;
  readonly defaultModel: string;

  generate(request: VideoGenerationRequest): Promise<VideoGenerationSubmission>;
  getStatus?(requestId: string): Promise<VideoGenerationStatus>;
}
