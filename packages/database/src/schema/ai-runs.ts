import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { videoJobs } from './jobs';

export const aiRuns = pgTable('ai_runs', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  jobId: text('job_id')
    .notNull()
    .references(() => videoJobs.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  status: text('status').notNull().default('SUCCESS'),
  attempt: integer('attempt').notNull().default(1),
  latencyMs: integer('latency_ms'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  inputMetadata: jsonb('input_metadata'),
  outputMetadata: jsonb('output_metadata'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AIRunEntity = typeof aiRuns.$inferSelect;
export type NewAIRunEntity = typeof aiRuns.$inferInsert;
