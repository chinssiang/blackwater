import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageGeneralQuery,
	pageGeneralSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { type Locale } from '@/lib/i18n';
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
	params: Promise<{ locale: string; slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getCachedPageData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageGeneralQuery,
		params: { slug, locale },
		tags: [`pGeneral:${slug}`],
	})
);

export async function generateMetadata(
	props: MetadataProps
): Promise<Metadata> {
	const { slug, locale } = await props.params;
	const { data } = await getCachedPageData(slug, locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function PageSlugRoute(props: MetadataProps) {
	const params = await props.params;

	const { data } = await getCachedPageData(params.slug, params.locale);

	const { sharing } = data || {};
	if (!data || sharing.disableIndex === true) return notFound();

	return <PageGeneral data={data} locale={params.locale as Locale} />;
}
