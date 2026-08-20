import { z } from 'zod';

export const JobEventTypeEnum = z.enum([
  'JOB_CREATED',
  'N8N_TRIGGERED',
  'N8N_TRIGGER_FAILED',
  'N8N_PROGRESS',
  'N8N_COMPLETED',
  'N8N_FAILED',
  'STATUS_CHANGED',
  'MANUAL_RETRY',
]);

export type JobEventType = z.infer<typeof JobEventTypeEnum>;

export const JobEventSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  eventId: z.string(),
  eventType: z.string(),
  stage: z.string(),
  progress: z.number().min(0).max(100),
  message: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date().or(z.string()),
});

export type JobEvent = z.infer<typeof JobEventSchema>;
