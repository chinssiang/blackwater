// The mechanism, for the call sites that point here: `defineLive` exists only in
// next-sanity's `react-server` export condition. Resolved from the client graph
// the same specifier yields a stub whose entire body is a throw, so a 'use client'
// import of this module used to fail at runtime with "defineLive can only be used
// in React Server Components". `server-only` turns that into a build error that
// names the boundary instead.
//
// So `<SanityLive />` is an async Server Component and can never sit in a lazy
// client chunk. It is rendered by `layout/HtmlShell.tsx`.
import type { ClientReturn, ContentSourceMap, QueryParams } from 'next-sanity';
import {
	type LivePerspective,
	type StrictDefinedFetchType,
	defineLive,
	resolvePerspectiveFromCookies,
	resolveVariantFromCookies,
} from 'next-sanity/live';
import { cookies, draftMode } from 'next/headers';
import { token } from '@/sanity/env';
import { client } from '@/sanity/lib/client';
import 'server-only';
import type { SanityRevalidateTag } from '@/types/sanity';

if (!token) {
	throw new Error('Missing SANITY_API_READ_TOKEN');
}

const { sanityFetch: liveSanityFetch, SanityLive } = defineLive({
	client,
	// Required for showing draft content when the Sanity Presentation Tool is used, or to enable the Vercel Toolbar Edit Mode
	serverToken: token,
	// Required for stand-alone live previews, the token is only shared to the browser if it's a valid Next.js Draft Mode session
	// KNOWN GAP: this is the same drafts-capable token as `serverToken` above, so
	// every draft session hands the browser read access to the whole dataset's
	// drafts. next-sanity's contract wants a viewer-scoped, published-only token
	// here; closing it needs a second env var, not a code change.
	browserToken: token,
	// Makes `perspective` and `stega` required on every fetch rather than resolved
	// implicitly inside next-sanity. That is the whole point of the wrapper below:
	// the request-scoped reads happen in ONE place, above any future cache
	// boundary, instead of being hidden inside each call.
	strict: true,
});

export { SanityLive };

/**
 * Whether this request should see drafts, and with stega encoding on.
 *
 * Deliberately resolved here and passed DOWN rather than read inside the fetch.
 * `draftMode()` and `cookies()` are Dynamic APIs and are illegal inside a
 * `'use cache'` boundary — next-sanity 12 calling them internally is exactly why
 * `cacheComponents: true` was tried and reverted (see the note in
 * next.config.mjs). Keeping them out here is what makes that flag reachable.
 */
async function getDynamicFetchOptions(): Promise<{
	perspective: LivePerspective;
	variant?: string;
	stega: boolean;
}> {
	const { isEnabled } = await draftMode();
	if (!isEnabled) {
		return { perspective: 'published', stega: false };
	}

	const cookieStore = await cookies();
	const perspective = await resolvePerspectiveFromCookies({
		cookies: cookieStore,
	});
	const variant = await resolveVariantFromCookies({ cookies: cookieStore });

	return { perspective: perspective ?? 'drafts', variant, stega: true };
}

type SanityFetchOptions<QueryString extends string> = {
	query: QueryString;
	params?: QueryParams | Promise<QueryParams>;
	tags?: SanityRevalidateTag[];
} &
	// The discriminant: a caller that names a perspective is on the static path.
	// `variant` is deliberately absent — it is produced inside
	// getDynamicFetchOptions and no caller supplies one.
	(
		| { perspective: LivePerspective; stega: boolean }
		| { perspective?: never; stega?: boolean }
	);

type SanityFetchResult<Data> = Promise<{
	data: Data;
	sourceMap: ContentSourceMap | null;
	tags: string[];
}>;

type Unbranded<Q extends string> = SanityFetchResult<ClientReturn<Q, unknown>>;

/**
 * Results are the clean TypeGen type.
 *
 * next-sanity 13 can additionally BRAND every string a draft-mode fetch returns
 * (`StegaBranded<T>`), so that comparing one to a literal without `stegaClean`
 * is a compile error — which is precisely the class of bug this repo has hit
 * repeatedly (the `timezone` RangeError that took /events down, `badge` tokens
 * rendering as raw slugs, `dateStatus` silently never matching 'confirmed').
 *
 * It is deliberately NOT adopted here yet. Branding propagates into every
 * component prop type, so switching it on turns ~45 call sites red at once and
 * needs the starter's `XData = XQueryResult | StegaBranded<XQueryResult>`
 * treatment applied across the component tree. That is its own piece of work,
 * not a side effect of the version bump. `ClientReturn<Q, unknown>` keeps the
 * `unknown` fallback either way, so a query that stops resolving is still loud
 * rather than silently `any`.
 */
export async function sanityFetch<const QueryString extends string>(
	options: SanityFetchOptions<QueryString>
): Unbranded<QueryString> {
	// A caller that supplies its own perspective has already said what it wants
	// and must not touch request-scoped APIs — that is the escape hatch keeping
	// generateStaticParams and the sitemaps fully static.
	const context =
		options.perspective !== undefined
			? options
			: await getDynamicFetchOptions();

	// The trailing `stega` wins over the one `...options` may carry as undefined.
	return (liveSanityFetch as StrictDefinedFetchType)({
		...context,
		...options,
		stega: options.stega ?? context.stega,
	}) as unknown as Unbranded<QueryString>; // strips StegaBranded — see above
}
