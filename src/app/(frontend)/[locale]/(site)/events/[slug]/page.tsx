import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageEventSingleQuery,
	pageEventSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import defineEventJsonLd from '@/lib/defineEventJsonLd';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
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
	params: Promise<{ locale: string; slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getCachedEventData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageEventSingleQuery,
		params: { slug, locale },
		tags: [`pEvent:${slug}`],
	})
);

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
	const { slug, locale } = await props.params;
	const { data } = await getCachedEventData(slug, locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function PageEventSlugRoute(props: MetadataProps) {
	const { slug, locale } = await props.params;
	const { data } = await getCachedEventData(slug, locale);

	if (!data) return <NotFoundContent locale={locale} />;

	const cleanData = stegaClean(data);
	const dict = await getDictionary(locale as Locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale: locale as Locale }) },
		{ name: dict.breadcrumb.events, path: resolveHref({ documentType: 'pEvents', locale: locale as Locale }) },
		{ name: cleanData?.title, path: resolveHref({ documentType: 'pEvent', slug, locale: locale as Locale }) },
	]);

	return (
		<>
			<JsonLd data={defineEventJsonLd({ data: cleanData, locale: locale as Locale })} />
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageEventSingle data={data} />
		</>
	);
}
