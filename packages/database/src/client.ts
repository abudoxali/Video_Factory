import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { isProductionRuntime, ProductionConfigError } from '@video-factory/contracts';
import * as schema from './schema/index';

let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

const DEV_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/video_factory';

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (isProductionRuntime() && (!databaseUrl || databaseUrl === DEV_DATABASE_URL)) {
    // Fail closed: production must never silently bind to the development database.
    throw new ProductionConfigError(
      'DATABASE_URL must be explicitly configured in production (development default is not allowed)'
    );
  }

  const resolvedUrl = databaseUrl || DEV_DATABASE_URL;

  // For serverless/long-running environments, keep max connection pool controlled
  client = postgres(resolvedUrl, {
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export const db = getDb();
export { schema };
