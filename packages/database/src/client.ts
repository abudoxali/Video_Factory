import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/video_factory';

  // For serverless/long-running environments, keep max connection pool controlled
  client = postgres(databaseUrl, {
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export const db = getDb();
export { schema };
