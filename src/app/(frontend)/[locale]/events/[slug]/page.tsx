import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageEventSingleQuery, pageEventSlugsQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import defineEventJsonLd from '@/lib/defineEventJsonLd';
import JsonLd from '@/components/JsonLd';
import PageEventSingle from '../_components/PageEventSingle';

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageEventSlugsQuery,
		perspective: 'published',
		stega: false,
	});

	return data;
}

type MetadataProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getCachedEventData = cache(async (slug: string) =>
	sanityFetch({
		query: pageEventSingleQuery,
		params: { slug },
		tags: [`pEvent:${slug}`],
	})
);

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
	const { slug } = await props.params;
	const { data } = await getCachedEventData(slug);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function PageEventSlugRoute(props: MetadataProps) {
	const { slug } = await props.params;
	const { data } = await getCachedEventData(slug);

	if (!data) return notFound();

	const cleanData = stegaClean(data);

	return (
		<>
			<JsonLd data={defineEventJsonLd({ data: cleanData })} />
			<PageEventSingle data={data} />
		</>
	);
}
