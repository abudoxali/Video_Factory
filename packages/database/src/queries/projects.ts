import { eq, sql, desc } from 'drizzle-orm';
import { getDb } from '../client';
import { projects, type Project, type NewProject } from '../schema/projects';
import { videos } from '../schema/videos';
import { createId } from '../ids';
import { DEFAULT_USER_ID } from './users';

export const DEFAULT_PROJECT_ID = 'prj_default';

export async function getOrCreateDefaultProject(userId: string = DEFAULT_USER_ID): Promise<Project> {
  const db = getDb();
  try {
    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.id, DEFAULT_PROJECT_ID))
      .limit(1);

    if (existing && existing.length > 0 && existing[0]) {
      return existing[0];
    }

    const [created] = await db
      .insert(projects)
      .values({
        id: DEFAULT_PROJECT_ID,
        userId,
        name: 'المشروع الرئيسي',
        slug: 'main-project',
        description: 'المشروع الافتراضي لتوليد مقاطع الفيديو والتجارب السريعة',
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: { updatedAt: new Date() },
      })
      .returning();

    return created;
  } catch (error) {
    return {
      id: DEFAULT_PROJECT_ID,
      userId,
      name: 'المشروع الرئيسي',
      slug: 'main-project',
      description: 'المشروع الافتراضي لتوليد مقاطع الفيديو والتجارب السريعة',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function listProjects(userId: string = DEFAULT_USER_ID) {
  const db = getDb();
  try {
    const result = await db
      .select({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        slug: projects.slug,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        videoCount: sql<number>`count(${videos.id})::int`,
      })
      .from(projects)
      .leftJoin(videos, eq(videos.projectId, projects.id))
      .where(eq(projects.userId, userId))
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt));

    return result;
  } catch (error) {
    return [];
  }
}

export async function createProject(params: {
  userId?: string;
  name: string;
  description?: string;
}): Promise<Project> {
  const db = getDb();
  const userId = params.userId || DEFAULT_USER_ID;
  const id = createId('prj');
  const slug = params.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `project-${Date.now()}`;

  const [created] = await db
    .insert(projects)
    .values({
      id,
      userId,
      name: params.name,
      slug,
      description: params.description || null,
    })
    .returning();

  return created;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = getDb();
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] || null;
}
