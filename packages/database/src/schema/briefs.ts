import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { videos } from './videos';

export const videoBriefs = pgTable('video_briefs', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  workingTitle: text('working_title').notNull(),
  coreIdea: text('core_idea').notNull(),
  objective: text('objective').notNull(),
  targetAudience: text('target_audience').notNull(),
  tone: text('tone').notNull(),
  contentAngle: text('content_angle').notNull(),
  hookStrategy: text('hook_strategy').notNull(),
  narrativeStyle: text('narrative_style').notNull(),
  visualDirection: text('visual_direction').notNull(),
  pacing: text('pacing').notNull().default('moderate'),
  callToAction: text('call_to_action'),
  keyPoints: jsonb('key_points').notNull().default('[]'),
  constraints: jsonb('constraints').notNull().default('[]'),
  planningNotes: text('planning_notes'),
  requiresResearch: boolean('requires_research').notNull().default(false),
  status: text('status').notNull().default('READY_FOR_REVIEW'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VideoBrief = typeof videoBriefs.$inferSelect;
export type NewVideoBrief = typeof videoBriefs.$inferInsert;
