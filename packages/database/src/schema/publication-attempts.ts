import { pgTable, varchar, integer, timestamp, text, jsonb, index } from 'drizzle-orm/pg-core';
import { publications } from './publications';

export const publicationAttempts = pgTable(
  'publication_attempts',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    publicationId: varchar('publication_id', { length: 128 })
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull().default(1),
    provider: varchar('provider', { length: 64 }).notNull(),
    status: varchar('status', { length: 64 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    providerRequestId: varchar('provider_request_id', { length: 255 }),
    errorCode: varchar('error_code', { length: 128 }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('publication_attempts_publication_id_idx').on(table.publicationId),
    index('publication_attempts_status_idx').on(table.status),
  ]
);

export type PublicationAttemptRecord = typeof publicationAttempts.$inferSelect;
export type NewPublicationAttemptRecord = typeof publicationAttempts.$inferInsert;
