import { pgTable, varchar, integer, timestamp, numeric, text, bigint, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { videos } from './videos';

export const renders = pgTable(
  'renders',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    videoId: varchar('video_id', { length: 128 })
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    status: varchar('status', { length: 64 }).notNull().default('PENDING'), // PENDING, QUEUED, PREPARING, RENDERING, UPLOADING, VALIDATING, READY, FAILED, CANCELLED, SUPERSEDED
    width: integer('width').notNull().default(1080),
    height: integer('height').notNull().default(1920),
    fps: integer('fps').notNull().default(30),
    durationSeconds: numeric('duration_seconds', { precision: 10, scale: 3 }),
    durationFrames: integer('duration_frames'),
    manifestJson: jsonb('manifest_json'),
    storageProvider: varchar('storage_provider', { length: 64 }).default('r2'),
    bucket: varchar('bucket', { length: 255 }),
    objectKey: text('object_key'),
    mimeType: varchar('mime_type', { length: 128 }).default('video/mp4'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    checksum: varchar('checksum', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('renders_video_id_idx').on(table.videoId),
    index('renders_status_idx').on(table.status),
    index('renders_video_version_idx').on(table.videoId, table.version),
  ]
);

export const rendersRelations = relations(renders, ({ one }) => ({
  video: one(videos, {
    fields: [renders.videoId],
    references: [videos.id],
  }),
}));

export type RenderRecord = typeof renders.$inferSelect;
export type NewRenderRecord = typeof renders.$inferInsert;
