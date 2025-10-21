import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

// Serverless-compatible database client for Vercel
// Uses HTTP-based Neon driver optimized for edge/serverless environments

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const sql = neon(databaseUrl);
    db = drizzle(sql, { schema });
  }

  return db;
}

// Export for direct use
export { schema };
