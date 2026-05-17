import { sanityFetch } from '@/sanity/lib/live';
import { page404Query } from '@/sanity/lib/queries';
import { PageNotFound } from './_components/PageNotFound';

export default async function NotFound() {
	const { data } = await sanityFetch({
		query: page404Query,
		tags: ['p404'],
	});
	return <PageNotFound data={data} />;
}
