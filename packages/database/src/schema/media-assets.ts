import { pgTable, text, integer, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { videos } from './videos';
import { scenes } from './scenes';
import { videoChapters } from './chapters';

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    sceneId: text('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
    chapterId: text('chapter_id').references(() => videoChapters.id, { onDelete: 'set null' }),
    type: text('type').notNull(), // 'IMAGE', 'VIDEO', 'VOICE', 'STOCK', 'TEXT_RESOURCE'
    source: text('source').notNull().default('GENERATED'), // 'GENERATED', 'UPLOADED', 'STOCK'
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    providerRequestId: text('provider_request_id'),
    storageProvider: text('storage_provider').notNull().default('r2'),
    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: numeric('duration_seconds', { precision: 8, scale: 2 }),
    status: text('status').notNull().default('ACTIVE'), // 'ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'FAILED'
    checksum: text('checksum'),
    generationRunId: text('generation_run_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('media_assets_video_id_idx').on(table.videoId),
    index('media_assets_scene_id_idx').on(table.sceneId),
    index('media_assets_status_idx').on(table.status),
    index('media_assets_type_idx').on(table.type),
  ]
);

export type MediaAssetEntity = typeof mediaAssets.$inferSelect;
export type NewMediaAssetEntity = typeof mediaAssets.$inferInsert;
