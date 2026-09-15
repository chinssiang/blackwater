import type { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { client } from '@/sanity/lib/client';
import * as queries from '@/sanity/lib/queries';
import { resolveHref } from '@/lib/routes';
import { type Locale } from '@/lib/i18n';

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const docId = searchParams.get('docId');
	const slug = searchParams.get('slug');
	const documentType = searchParams.get('documentType');
	const lang = searchParams.get('lang');
	const homePageID = await client.fetch(queries.homeID);

	// homePageID is `string | null` — the query returns null on a dataset with
	// no pHome document. Guard it: `includes(null)` coerces to the string
	// "null", which matches any id containing that substring and misses the
	// real homepage. `includes` rather than `===` so a `drafts.` id matches.
	if (homePageID && docId && docId.includes(homePageID)) {
		redirect('/');
	}

	const url = resolveHref({
		documentType: documentType,
		slug,
		locale: lang as Locale | null,
	});
	redirect(url || '/');
}
