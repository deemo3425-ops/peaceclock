import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/db/schema',
  out: './packages/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || '',
  },
});
