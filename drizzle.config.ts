import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes a migration from the schema and needs no
// database. `npm run db:migrate` applies pending ones to DATABASE_URL, and is
// run by hand, never by the build: CI and preview deploys have no database of
// their own, and a migration should not ride along with an unrelated deploy.
export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/member/schema.ts',
	out: './drizzle',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
