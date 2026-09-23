import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes a migration from the schema and needs no
// database. `npm run db:migrate` applies pending ones to DATABASE_URL, and is
// run by hand, never by the build: CI and preview deploys have no database of
// their own, and a migration should not ride along with an unrelated deploy.

// drizzle-kit reads only `.env`, but .env.example -- and `vercel env pull` --
// put local values in `.env.local`. Load it here; a variable already set in the
// shell still wins.
try {
	process.loadEnvFile('.env.local');
} catch {
	// No .env.local: the shell or .env must provide DATABASE_URL.
}

// Without this, a missing URL reaches drizzle-kit as '' and surfaces as a
// connection error that never names the variable.
if (!process.env.DATABASE_URL && process.argv.includes('migrate')) {
	throw new Error(
		'DATABASE_URL is not set. Put it in .env.local (`vercel env pull .env.local`) or export it in the shell.'
	);
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/member/schema.ts',
	out: './drizzle',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
