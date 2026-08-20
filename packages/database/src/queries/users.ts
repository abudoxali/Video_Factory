import { eq } from 'drizzle-orm';
import { getDb } from '../client';
import { users, type User } from '../schema/users';
import { createId } from '../ids';

export const DEFAULT_USER_ID = 'usr_dev_default';

export async function getOrCreateDefaultUser(): Promise<User> {
  const db = getDb();
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, DEFAULT_USER_ID))
      .limit(1);

    if (existing && existing.length > 0 && existing[0]) {
      return existing[0];
    }

    const [created] = await db
      .insert(users)
      .values({
        id: DEFAULT_USER_ID,
        name: 'مطور النظام الافتراضي',
        email: 'dev@videofactory.local',
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { updatedAt: new Date() },
      })
      .returning();

    return created;
  } catch (error) {
    return {
      id: DEFAULT_USER_ID,
      name: 'مطور النظام الافتراضي',
      email: 'dev@videofactory.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
