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

// The `$upcomingFrom` bound below is only a payload guard for eventsBlock
// modules -- selectUpcomingEvents() makes the real "is this still upcoming?"
// decision at render time. It is day-granular so the Data Cache key changes once
// a day rather than once per request, and set a day EARLY so nothing hinges on a
// boundary comparison between two ISO strings of differing millisecond precision.
function getUpcomingFrom(): string {
	const from = new Date();
	from.setDate(from.getDate() - 1);
	from.setHours(0, 0, 0, 0);
	return from.toISOString();
}

// An eventsBlock's output depends on the wall clock (the bound above, and the
// ended state each row renders), so tag-based invalidation alone is not enough --
// with no content edits the prerendered HTML would keep serving build-time state.
// Composes with the content tags rather than replacing them. This is still SSG
// with ISR, not dynamic rendering.
//
// Known cost, and it is deliberate rather than overlooked: Next takes the MINIMUM
// revalidate across every fetch on a route, so this also caps the no-TTL policy
// that src/lib/shopify/product.ts argues for -- a productsBlock's Storefront
// lookup expires hourly here instead of only on a webhook. That is churn, not
// staleness (the webhook still invalidates), and it is the price of letting the
// events module live on a prerendered page. If the regeneration volume ever
// matters, the way out is a daily cron hitting /api/revalidate-tag for `pEvent`
// rather than a shorter interval here.
export const revalidate = 3600;

const getCachedHomeData = cache(async (locale: string) =>
	sanityFetch({
		query: pageHomeQuery,
		params: { locale, upcomingFrom: getUpcomingFrom() },
		// One tag per type the page's modules dereference. gFaqList + gFaq for
		// faqBlock; pEvent/gLocation/pEventStatus for eventsBlock; pProduct,
		// pProductCollection, pProductCategory and pBrand for productsBlock (the
		// card projection derefs categories[]-> and brands[]->).
		// settingsBrandColors: sectionAppearance derefs backgroundColor->/textColor->.
		tags: [
			'pHome',
			'gFaq',
			'gFaqList',
			'pEvent',
			'gLocation',
			'pEventStatus',
			'pProduct',
			'pProductCollection',
			'pProductCategory',
			'pBrand',
			'settingsBrandColors',
		],
	})
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
			<PageHome data={data} locale={locale as Locale} />
		</>
	);
}
