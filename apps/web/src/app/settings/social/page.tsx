import React from 'react';
import { getAuthenticatedUser } from '@/lib/session';
import { getSocialAccounts } from '@video-factory/database';
import { SocialAccountsManager } from './SocialAccountsManager';

export const dynamic = 'force-dynamic';

export default async function SocialSettingsPage() {
  const user = await getAuthenticatedUser();
  const rawAccounts = user ? await getSocialAccounts(user.userId) : [];

  const initialAccounts = rawAccounts.map((acc) => ({
    id: acc.id,
    platform: acc.platform as any,
    platformUserId: acc.platformUserId,
    platformUsername: acc.platformUsername,
    displayName: acc.displayName,
    avatarUrl: acc.avatarUrl,
    status: acc.status,
    scopes: Array.isArray(acc.scopes) ? (acc.scopes as string[]) : [],
    tokenExpiresAt: acc.tokenExpiresAt ? acc.tokenExpiresAt.toISOString() : null,
    connectedAt: acc.connectedAt ? acc.connectedAt.toISOString() : '',
  }));

  return <SocialAccountsManager initialAccounts={initialAccounts} />;
}
