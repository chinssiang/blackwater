import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageContactQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { PageContact } from './_components/PageContact';

const getCachedContactData = cache(async () =>
	sanityFetch({ query: pageContactQuery, tags: ['pContact'] })
);

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await getCachedContactData();
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page() {
	const { data } = await getCachedContactData();
	const { sharing } = data || {};

	if (!data || sharing.disableIndex === true) return notFound();

	return <PageContact data={data} />;
}
