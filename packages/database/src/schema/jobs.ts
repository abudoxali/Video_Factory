import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { videos } from './videos';

export const videoJobs = pgTable('video_jobs', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('QUEUED'),
  progress: integer('progress').notNull().default(0),
  currentStage: text('current_stage').notNull().default('RECEIVED'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VideoJob = typeof videoJobs.$inferSelect;
export type NewVideoJob = typeof videoJobs.$inferInsert;
