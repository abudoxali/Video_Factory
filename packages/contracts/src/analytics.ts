import { z } from 'zod';
import { SocialPlatformEnum, type SocialPlatform } from './social';

export const AnalyticsSnapshotSchema = z.object({
  id: z.string(),
  publicationId: z.string(),
  platform: SocialPlatformEnum,
  capturedAt: z.coerce.date().default(() => new Date()),
  views: z.number().int().nonnegative().nullable().optional(),
  likes: z.number().int().nonnegative().nullable().optional(),
  comments: z.number().int().nonnegative().nullable().optional(),
  shares: z.number().int().nonnegative().nullable().optional(),
  watchTimeSeconds: z.number().nonnegative().nullable().optional(),
  averageViewDurationSeconds: z.number().nonnegative().nullable().optional(),
  followersGained: z.number().int().nullable().optional(),
  rawSupportedMetrics: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date().default(() => new Date()),
});
export type AnalyticsSnapshot = z.infer<typeof AnalyticsSnapshotSchema>;

export const ArabicAnalyticsMetricsMap: Record<string, string> = {
  views: 'المشاهدات',
  likes: 'الإعجابات',
  comments: 'التعليقات',
  shares: 'المشاركات',
  watchTimeSeconds: 'إجمالي وقت المشاهدة (ثوانٍ)',
  averageViewDurationSeconds: 'متوسط مدة المشاهدة (ثوانٍ)',
  followersGained: 'المتابعون الجدد',
};

export function getArabicAnalyticsMetric(metric: string): string {
  return ArabicAnalyticsMetricsMap[metric] || metric;
}
