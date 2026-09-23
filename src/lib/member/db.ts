import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/*
 * The ONLY place a database client is created, and the eslint config fences it:
 * nothing outside src/lib/member/ may import this file or a driver. Without row
 * level security the database will serve any member's rows to any query, so
 * the fence is what keeps every read going through code that scopes it.
 *
 * Created on first use, not at import: `next build` imports this module to
 * collect page data, and neither CI nor a preview deploy has a DATABASE_URL.
 * neon-http speaks HTTP per query, which suits serverless (no pool to drain),
 * at the cost of interactive transactions -- write single statements.
 */

let db: ReturnType<typeof createDb> | undefined;

function createDb() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('Missing environment variable: DATABASE_URL');
	return drizzle(neon(url), { schema });
}

export function getDb() {
	return (db ??= createDb());
}
