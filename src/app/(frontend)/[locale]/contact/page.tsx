import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageContactQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { PageContact } from './_components/PageContact';

const getCachedContactData = cache(async (locale: string) =>
	sanityFetch({ query: pageContactQuery, params: { locale }, tags: ['pContact'] })
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedContactData(locale);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedContactData(locale);
	const { sharing } = data || {};

	if (!data || sharing.disableIndex === true) return notFound();

	return <PageContact data={data} />;
}
