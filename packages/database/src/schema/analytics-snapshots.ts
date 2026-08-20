import { pgTable, varchar, integer, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { publications } from './publications';

export const analyticsSnapshots = pgTable(
  'analytics_snapshots',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    publicationId: varchar('publication_id', { length: 128 })
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 32 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
    views: integer('views'),
    likes: integer('likes'),
    comments: integer('comments'),
    shares: integer('shares'),
    watchTimeSeconds: numeric('watch_time_seconds', { precision: 12, scale: 2 }),
    averageViewDurationSeconds: numeric('average_view_duration_seconds', { precision: 10, scale: 2 }),
    followersGained: integer('followers_gained'),
    rawSupportedMetrics: jsonb('raw_supported_metrics').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('analytics_snapshots_pub_captured_idx').on(table.publicationId, table.capturedAt),
  ]
);

export type AnalyticsSnapshotRecord = typeof analyticsSnapshots.$inferSelect;
export type NewAnalyticsSnapshotRecord = typeof analyticsSnapshots.$inferInsert;
