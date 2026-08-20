import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { videoJobs } from './jobs';

export const jobEvents = pgTable('job_events', {
  id: text('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => videoJobs.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().unique(), // Idempotency constraint
  eventType: text('event_type').notNull(),
  stage: text('stage').notNull(),
  progress: integer('progress').notNull(),
  message: text('message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type JobEvent = typeof jobEvents.$inferSelect;
export type NewJobEvent = typeof jobEvents.$inferInsert;
