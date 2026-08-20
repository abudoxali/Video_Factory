import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { videoBriefs } from './briefs';

export const videoScripts = pgTable('video_scripts', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  briefId: text('brief_id').references(() => videoBriefs.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  hook: text('hook').notNull(),
  sections: jsonb('sections').notNull().default('[]'),
  fullNarration: text('full_narration').notNull(),
  estimatedWordCount: integer('estimated_word_count').notNull().default(0),
  estimatedDurationSeconds: integer('estimated_duration_seconds').notNull().default(0),
  language: text('language').notNull().default('ar'),
  callToAction: text('call_to_action'),
  scriptVersion: integer('script_version').notNull().default(1),
  status: text('status').notNull().default('READY_FOR_REVIEW'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VideoScriptEntity = typeof videoScripts.$inferSelect;
export type NewVideoScriptEntity = typeof videoScripts.$inferInsert;
