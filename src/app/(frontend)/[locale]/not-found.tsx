import { resolveLocale } from '@/lib/locale-server';
import { sanityFetch } from '@/sanity/lib/live';
import { page404Query } from '@/sanity/lib/queries';
import { PageNotFound } from './_components/PageNotFound';

export default async function NotFound() {
	const locale = await resolveLocale();
	const { data } = await sanityFetch({
		query: page404Query,
		params: { locale },
		tags: ['p404'],
	});
	return <PageNotFound data={data} />;
}
