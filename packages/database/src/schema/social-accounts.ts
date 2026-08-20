import { pgTable, varchar, timestamp, text, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 32 }).notNull(), // 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
    platformUserId: varchar('platform_user_id', { length: 255 }).notNull(),
    platformUsername: varchar('platform_username', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    status: varchar('status', { length: 64 }).notNull().default('CONNECTED'),
    scopes: jsonb('scopes').default('[]'),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('social_accounts_user_platform_idx').on(table.userId, table.platform),
    index('social_accounts_status_idx').on(table.status),
    uniqueIndex('social_accounts_platform_user_idx').on(table.userId, table.platform, table.platformUserId),
  ]
);

export type SocialAccountRecord = typeof socialAccounts.$inferSelect;
export type NewSocialAccountRecord = typeof socialAccounts.$inferInsert;
