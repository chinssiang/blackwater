import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageHomeQuery } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import defineFaqJsonLd, { collectFaqItems } from '@/lib/defineFaqJsonLd';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import PageHome from '../_components/PageHome';

const getCachedHomeData = cache(async (locale: string) =>
	sanityFetch({ query: pageHomeQuery, params: { locale }, tags: ['pHome'] })
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedHomeData(locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
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

	const faqJsonLd = defineFaqJsonLd(collectFaqItems(stegaClean(data.pageModules)));

	return (
		<>
			{faqJsonLd && <JsonLd data={faqJsonLd} />}
			<PageHome data={data} />
		</>
	);
}
