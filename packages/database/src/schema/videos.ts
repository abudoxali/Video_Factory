import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

export const videos = pgTable('videos', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  type: text('type').notNull(), // 'short' | 'long'
  durationSeconds: integer('duration_seconds').notNull(),
  language: text('language').notNull().default('ar'),
  platform: text('platform').notNull(), // 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'youtube' | 'linkedin' | 'x'
  aspectRatio: text('aspect_ratio').notNull(), // '9:16' | '16:9' | '1:1'
  status: text('status').notNull().default('QUEUED'),
  planStatus: text('plan_status').notNull().default('PENDING'), // 'PENDING' | 'GENERATING' | 'READY_FOR_REVIEW' | 'APPROVED' | 'STALE'
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
