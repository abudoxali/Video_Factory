import type { VideoProvider } from './types';
import type {
  VideoGenerationRequest,
  VideoGenerationSubmission,
  VideoGenerationStatus,
} from '@video-factory/contracts';

// Tiny mock MP4 buffer
const MOCK_MP4_BUFFER = Buffer.from(
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhmZGF0',
  'base64'
);

export class MockVideoProvider implements VideoProvider {
  public readonly name = 'mock-video';
  public readonly defaultModel: string = 'mock-omni-video';
  public shouldFail = false;

  public async generate(request: VideoGenerationRequest): Promise<VideoGenerationSubmission> {
    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        model: this.defaultModel,
        requestId: `mock_fail_${Date.now()}`,
        status: 'FAILED',
        error: {
          code: 'MEDIA_PROVIDER_ERROR',
          message: 'فشل محاكي توليد الفيديو للاختبار',
        },
      };
    }

    const requestId = `mock_vid_${Date.now()}`;
    return {
      success: true,
      provider: this.name,
      model: this.defaultModel,
      requestId,
      status: 'PROCESSING',
      estimatedDurationSeconds: request.durationSeconds || 5,
    };
  }

  public async getStatus(requestId: string): Promise<VideoGenerationStatus> {
    if (this.shouldFail) {
      return {
        requestId,
        status: 'FAILED',
        error: {
          code: 'MEDIA_PROVIDER_ERROR',
          message: 'فشل الاستعلام للاختبار',
        },
      };
    }

    return {
      requestId,
      status: 'COMPLETED',
      progress: 100,
      buffer: MOCK_MP4_BUFFER,
      videoUrl: `https://mock-video-provider.local/${requestId}.mp4`,
      mimeType: 'video/mp4',
      durationSeconds: 5,
      width: 720,
      height: 1280,
    };
  }
}
