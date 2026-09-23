import { getAuth } from '@/lib/member/auth';

// Every endpoint under /api/auth is Better Auth's. `getAuth()` is called per
// request, not at import, so `next build` needs no database.
export function GET(request: Request) {
	return getAuth().handler(request);
}

export function POST(request: Request) {
	return getAuth().handler(request);
}
