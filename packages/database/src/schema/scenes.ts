import { pgTable, text, integer, timestamp, numeric } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { videoChapters } from './chapters';

export const scenes = pgTable('scenes', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => videoChapters.id, { onDelete: 'set null' }),
  position: integer('position').notNull(),
  purpose: text('purpose').notNull().default(''),
  narration: text('narration').notNull().default(''),
  onScreenText: text('on_screen_text'),
  visualDescription: text('visual_description').notNull(),
  visualPrompt: text('visual_prompt').notNull(),
  mediaStrategy: text('media_strategy').notNull().default('AI_VIDEO'),
  animationDirection: text('animation_direction'),
  cameraDirection: text('camera_direction'),
  transition: text('transition'),
  durationSeconds: integer('duration_seconds').notNull(),
  startTime: integer('start_time').notNull().default(0),
  endTime: integer('end_time').notNull().default(0),
  shotType: text('shot_type'),
  lighting: text('lighting'),
  environment: text('environment'),
  subject: text('subject'),
  characterNotes: text('character_notes'),
  continuityNotes: text('continuity_notes'),
  status: text('status').notNull().default('PLANNED'),
  // Phase 03 Media additions
  mediaState: text('media_state').notNull().default('PENDING'),
  voiceEstimatedDurationSeconds: numeric('voice_estimated_duration_seconds', { precision: 6, scale: 2 }),
  voiceActualDurationSeconds: numeric('voice_actual_duration_seconds', { precision: 6, scale: 2 }),
  characterKey: text('character_key'),
  referenceAssetId: text('reference_asset_id'),
  styleReferenceAssetId: text('style_reference_asset_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SceneEntity = typeof scenes.$inferSelect;
export type NewSceneEntity = typeof scenes.$inferInsert;
