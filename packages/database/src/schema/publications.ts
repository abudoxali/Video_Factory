import { pgTable, varchar, timestamp, text, jsonb, index } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { renders } from './renders';
import { socialAccounts } from './social-accounts';
import { users } from './users';

export const publications = pgTable(
  'publications',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    videoId: varchar('video_id', { length: 128 })
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    renderId: varchar('render_id', { length: 128 })
      .notNull()
      .references(() => renders.id, { onDelete: 'cascade' }),
    socialAccountId: varchar('social_account_id', { length: 128 })
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 32 }).notNull(), // 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
    status: varchar('status', { length: 64 }).notNull().default('DRAFT'),
    metadataJson: jsonb('metadata_json').notNull(),
    platformPublicationId: varchar('platform_publication_id', { length: 255 }),
    platformUrl: text('platform_url'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('publications_video_id_idx').on(table.videoId),
    index('publications_render_id_idx').on(table.renderId),
    index('publications_social_account_id_idx').on(table.socialAccountId),
    index('publications_user_id_idx').on(table.userId),
    index('publications_status_idx').on(table.status),
    index('publications_idempotency_key_idx').on(table.idempotencyKey),
    index('publications_scheduled_at_idx').on(table.scheduledAt),
  ]
);

export type PublicationRecord = typeof publications.$inferSelect;
export type NewPublicationRecord = typeof publications.$inferInsert;
