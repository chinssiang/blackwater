import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageHomeQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import PageHome from './_components/PageHome';

const getCachedHomeData = cache(async () =>
	sanityFetch({ query: pageHomeQuery, tags: ['pHome'] })
);

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await getCachedHomeData();
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page() {
	const { data } = await getCachedHomeData();

	if (!data)
		return (
			<div className="flex h-screen items-center justify-center">
				<p>
					Edit the content in{' '}
					<Link
						href="/sanity/structure/pages;homepage"
						className="text-blue underline"
					>
						/sanity/structure/pages;homepage
					</Link>
				</p>
			</div>
		);

	return <PageHome data={data} />;
}
