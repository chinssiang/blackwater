import { sanityFetch } from '@/sanity/lib/live';
import { page404Query } from '@/sanity/lib/queries';
import { PageNotFound } from './PageNotFound';

// Rendered inline in place of notFound() — in this app (embedded Sanity Studio
// forces a route-group structure with no true app/layout.tsx) Next.js never
// renders a custom not-found.tsx for notFound() thrown in a matched route, so
// pages render this instead. The data-not-found marker lets globals.css hide the
// Newsletter and Footer on 404s via body:has([data-not-found]).
// Trade-off: the response is HTTP 200 (soft 404).
export async function NotFoundContent({ locale }: { locale: string }) {
	const { data } = await sanityFetch({
		query: page404Query,
		params: { locale },
		tags: ['p404'],
	});
	return (
		<div data-not-found="">
			<PageNotFound data={data} />
		</div>
	);
}
