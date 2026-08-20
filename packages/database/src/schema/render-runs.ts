import { pgTable, varchar, integer, timestamp, text, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { renders } from './renders';
import { videos } from './videos';

export const renderRuns = pgTable(
  'render_runs',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    renderId: varchar('render_id', { length: 128 })
      .notNull()
      .references(() => renders.id, { onDelete: 'cascade' }),
    videoId: varchar('video_id', { length: 128 })
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    engine: varchar('engine', { length: 64 }).notNull().default('remotion'),
    engineVersion: varchar('engine_version', { length: 64 }).default('4.0.0'),
    status: varchar('status', { length: 64 }).notNull().default('PROCESSING'), // PROCESSING, COMPLETED, FAILED
    attempt: integer('attempt').notNull().default(1),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    errorCode: varchar('error_code', { length: 128 }),
    errorMessage: text('error_message'),
    inputMetadata: jsonb('input_metadata'),
    outputMetadata: jsonb('output_metadata'),
  },
  (table) => [
    index('render_runs_render_id_idx').on(table.renderId),
    index('render_runs_video_id_idx').on(table.videoId),
    index('render_runs_status_idx').on(table.status),
  ]
);

export const renderRunsRelations = relations(renderRuns, ({ one }) => ({
  render: one(renders, {
    fields: [renderRuns.renderId],
    references: [renders.id],
  }),
  video: one(videos, {
    fields: [renderRuns.videoId],
    references: [videos.id],
  }),
}));

export type RenderRunRecord = typeof renderRuns.$inferSelect;
export type NewRenderRunRecord = typeof renderRuns.$inferInsert;
