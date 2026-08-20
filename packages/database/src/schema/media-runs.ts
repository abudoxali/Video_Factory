import { pgTable, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { scenes } from './scenes';

export const mediaRuns = pgTable(
  'media_runs',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    sceneId: text('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
    type: text('type').notNull(), // 'IMAGE', 'VIDEO', 'VOICE'
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    providerRequestId: text('provider_request_id'),
    status: text('status').notNull().default('PENDING'), // 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    attempt: integer('attempt').notNull().default(1),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    inputMetadata: jsonb('input_metadata'),
    outputMetadata: jsonb('output_metadata'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    usageMetadata: jsonb('usage_metadata'),
    costMetadata: jsonb('cost_metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('media_runs_video_id_idx').on(table.videoId),
    index('media_runs_scene_id_idx').on(table.sceneId),
    index('media_runs_status_idx').on(table.status),
  ]
);

export type MediaRunEntity = typeof mediaRuns.$inferSelect;
export type NewMediaRunEntity = typeof mediaRuns.$inferInsert;
