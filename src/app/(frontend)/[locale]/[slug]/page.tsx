import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageGeneralQuery, pageGeneralSlugsQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import PageGeneral from '../_components/PageGeneral';

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageGeneralSlugsQuery,
		perspective: 'published',
		stega: false,
	});

	return data;
}

type MetadataProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getCachedPageData = cache(async (slug: string) =>
	sanityFetch({
		query: pageGeneralQuery,
		params: { slug },
		tags: [`pGeneral:${slug}`],
	})
);

export async function generateMetadata(
	props: MetadataProps
): Promise<Metadata> {
	const { slug } = await props.params;
	const { data } = await getCachedPageData(slug);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function PageSlugRoute(props: MetadataProps) {
	const params = await props.params;

	const { data } = await getCachedPageData(params.slug);

	const { sharing } = data || {};
	if (!data || sharing.disableIndex === true) return notFound();

	return <PageGeneral data={data} />;
}
