import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageHomeQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import PageHome from './_components/PageHome';

const getCachedHomeData = cache(async (locale: string) =>
	sanityFetch({ query: pageHomeQuery, params: { locale }, tags: ['pHome'] })
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedHomeData(locale);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedHomeData(locale);

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
