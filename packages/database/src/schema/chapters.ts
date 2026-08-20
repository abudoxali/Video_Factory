import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { videos } from './videos';

export const videoChapters = pgTable('video_chapters', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  purpose: text('purpose').notNull(),
  summary: text('summary').notNull(),
  targetDurationSeconds: integer('target_duration_seconds').notNull(),
  scriptText: text('script_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VideoChapterEntity = typeof videoChapters.$inferSelect;
export type NewVideoChapterEntity = typeof videoChapters.$inferInsert;
