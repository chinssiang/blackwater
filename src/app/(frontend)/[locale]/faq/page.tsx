import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageFaqQuery } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import defineFaqJsonLd from '@/lib/defineFaqJsonLd';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import { PageFaq } from './_components/PageFaq';

const getCachedFaqData = cache(async (locale: string) =>
	sanityFetch({
		query: pageFaqQuery,
		params: { locale },
		tags: ['pFaq', 'gFaq'],
	})
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedFaqData(locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedFaqData(locale);

	const { sharing } = data || {};
	if (!data || sharing?.disableIndex === true) return notFound();

	const cleanData = stegaClean(data);
	const faqJsonLd = defineFaqJsonLd(cleanData?.items);

	return (
		<>
			{faqJsonLd && <JsonLd data={faqJsonLd} />}
			<PageFaq data={data} />
		</>
	);
}
