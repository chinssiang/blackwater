import 'server-only';
import { getAuth } from './auth';

// Every endpoint under /api/auth is Better Auth's. Lives inside the fence so
// the route file needs no import of ./auth, which can read any member's rows.
// getAuth() is called per request, not at import, so the build needs no
// database.
export function GET(request: Request) {
	return getAuth().handler(request);
}

export function POST(request: Request) {
	return getAuth().handler(request);
}
