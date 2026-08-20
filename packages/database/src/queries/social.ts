import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../client';
import { socialAccounts, type SocialAccountRecord, type NewSocialAccountRecord } from '../schema/social-accounts';

export interface SaveSocialAccountInput {
  id?: string;
  userId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  platformUserId: string;
  platformUsername?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  scopes?: string[];
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Upserts a connected social account by (userId, platform, platformUserId)
 */
export async function saveSocialAccountTransaction(
  input: SaveSocialAccountInput
): Promise<SocialAccountRecord> {
  const db = getDb();
  const accountId = input.id || `soc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await db.transaction(async (tx: any) => {
    // Check if account already exists for this user and platform
    const existing = await tx
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.userId, input.userId),
          eq(socialAccounts.platform, input.platform),
          eq(socialAccounts.platformUserId, input.platformUserId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await tx
        .update(socialAccounts)
        .set({
          platformUsername: input.platformUsername ?? existing[0].platformUsername,
          displayName: input.displayName ?? existing[0].displayName,
          avatarUrl: input.avatarUrl ?? existing[0].avatarUrl,
          status: 'CONNECTED',
          scopes: input.scopes ? input.scopes : existing[0].scopes,
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted: input.refreshTokenEncrypted ?? existing[0].refreshTokenEncrypted,
          tokenExpiresAt: input.tokenExpiresAt ?? existing[0].tokenExpiresAt,
          refreshExpiresAt: input.refreshExpiresAt ?? existing[0].refreshExpiresAt,
          metadata: input.metadata ? { ...(existing[0].metadata as any), ...input.metadata } : existing[0].metadata,
          lastRefreshedAt: new Date(),
          revokedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(socialAccounts.id, existing[0].id))
        .returning();

      return updated;
    }

    // Insert new account record
    const [created] = await tx
      .insert(socialAccounts)
      .values({
        id: accountId,
        userId: input.userId,
        platform: input.platform,
        platformUserId: input.platformUserId,
        platformUsername: input.platformUsername,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        status: 'CONNECTED',
        scopes: input.scopes || [],
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        refreshExpiresAt: input.refreshExpiresAt,
        metadata: input.metadata,
        connectedAt: new Date(),
        lastRefreshedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  });
}

/**
 * Gets all social accounts for a user
 */
export async function getSocialAccounts(userId: string): Promise<SocialAccountRecord[]> {
  const db = getDb();
  return await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, userId))
    .orderBy(desc(socialAccounts.createdAt));
}

/**
 * Gets a specific social account by ID with optional ownership verification
 */
export async function getSocialAccountById(
  accountId: string,
  userId?: string
): Promise<SocialAccountRecord | null> {
  const db = getDb();
  const conditions = [eq(socialAccounts.id, accountId)];
  if (userId) {
    conditions.push(eq(socialAccounts.userId, userId));
  }

  const results = await db
    .select()
    .from(socialAccounts)
    .where(and(...conditions))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Gets a connected social account by platform for a user
 */
export async function getSocialAccountByPlatform(
  userId: string,
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
): Promise<SocialAccountRecord | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.platform, platform),
        eq(socialAccounts.status, 'CONNECTED')
      )
    )
    .orderBy(desc(socialAccounts.updatedAt))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Updates refreshed encrypted tokens for an account
 */
export async function updateSocialAccountTokens(
  accountId: string,
  tokens: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | null;
    refreshExpiresAt?: Date | null;
  }
): Promise<void> {
  const db = getDb();
  await db
    .update(socialAccounts)
    .set({
      accessTokenEncrypted: tokens.accessTokenEncrypted,
      refreshTokenEncrypted: tokens.refreshTokenEncrypted,
      tokenExpiresAt: tokens.tokenExpiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      status: 'CONNECTED',
      lastRefreshedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.id, accountId));
}

/**
 * Updates account status
 */
export async function updateSocialAccountStatus(
  accountId: string,
  status: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  await db
    .update(socialAccounts)
    .set({
      status,
      metadata: metadata ? (metadata as any) : undefined,
      revokedAt: status === 'REVOKED' || status === 'DISCONNECTED' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.id, accountId));
}

/**
 * Disconnects a social account safely (clears active tokens)
 */
export async function disconnectSocialAccount(
  accountId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(socialAccounts)
    .set({
      status: 'DISCONNECTED',
      accessTokenEncrypted: '',
      refreshTokenEncrypted: null,
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(socialAccounts.id, accountId),
        eq(socialAccounts.userId, userId)
      )
    )
    .returning();

  return result.length > 0;
}
