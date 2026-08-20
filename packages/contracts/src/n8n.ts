import { z } from 'zod';
import { JobStatusEnum } from './jobs';
import {
  VideoTypeEnum,
  VideoPlatformEnum,
  VideoAspectRatioEnum,
  VideoLanguageEnum,
} from './videos';

export const N8nStartPayloadSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  job_id: z.string().min(1, 'job_id is required'),
  video_id: z.string().min(1, 'video_id is required'),
  request: z.object({
    prompt: z.string().min(1),
    type: VideoTypeEnum,
    duration_seconds: z.number().int().positive(),
    language: VideoLanguageEnum,
    platform: VideoPlatformEnum,
    aspect_ratio: VideoAspectRatioEnum,
  }),
});

export type N8nStartPayload = z.infer<typeof N8nStartPayloadSchema>;

export const N8nCallbackPayloadSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  event_id: z.string().min(1, 'event_id is required'),
  job_id: z.string().min(1, 'job_id is required'),
  event: z.string().min(1, 'event name is required'),
  status: JobStatusEnum,
  stage: z.string().min(1, 'stage identifier is required'),
  progress: z.number().min(0, 'progress must be >= 0').max(100, 'progress must be <= 100'),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type N8nCallbackPayload = z.infer<typeof N8nCallbackPayloadSchema>;

export const N8nCallbackResponseSchema = z.object({
  success: z.boolean(),
  job_id: z.string(),
  event_id: z.string(),
  status: JobStatusEnum,
  progress: z.number(),
  stage: z.string(),
  idempotent: z.boolean().optional(),
});

export type N8nCallbackResponse = z.infer<typeof N8nCallbackResponseSchema>;
