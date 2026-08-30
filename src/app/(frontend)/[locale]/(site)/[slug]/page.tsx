import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageGeneralQuery,
	pageGeneralSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, {
	normalizeLocales,
	notFoundMetadata,
} from '@/lib/defineMetadata';
import defineFaqJsonLd, { collectFaqItems } from '@/lib/defineFaqJsonLd';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import PageGeneral from '../../_components/PageGeneral';

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageGeneralSlugsQuery,
		perspective: 'published',
		stega: false,
		// Without a tag this list caches forever under the catch-all 'sanity'
		// tag, which nothing invalidates — so a build could reuse a stale slug
		// list and skip prerendering a newly published document.
		tags: ['pGeneral'],
	});

	return data;
}

type MetadataProps = {
	params: Promise<{ locale: string; slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

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

const getCachedPageData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageGeneralQuery,
		params: { slug, locale, upcomingFrom: getUpcomingFrom() },
		// gFaqList + gFaq: faqBlock modules deref faqSet->questions[]->, so both
		// the set and the entries it names have to invalidate this page.
		// pEvent/gLocation/pEventStatus: eventsBlock. pProduct/pProductCollection/
		// pProductCategory/pBrand: productsBlock, whose card projection derefs
		// categories[]-> and brands[]->.
		// settingsBrandColors: sectionAppearance derefs backgroundColor->/textColor->.
		tags: [
			`pGeneral:${slug}`,
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

export async function generateMetadata(
	props: MetadataProps
): Promise<Metadata> {
	const { slug, locale } = await props.params;
	const { data } = await getCachedPageData(slug, locale);
	const cleanData = stegaClean(data);
	// This route, not [...rest], is what an unknown single-segment path lands on
	// (/nope, not /a/b/c), so it is the common soft-404 and needs de-indexing.
	if (!cleanData) return notFoundMetadata();
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function PageSlugRoute(props: MetadataProps) {
	const params = await props.params;

	// Independent: the page document is a Sanity round trip, the dictionary a
	// local import. Awaited in sequence the dictionary sat behind the network
	// call for no reason — same shape as the product routes.
	const [{ data }, dict] = await Promise.all([
		getCachedPageData(params.slug, params.locale),
		getDictionary(params.locale as Locale),
	]);

	const { sharing } = data || {};
	if (!data || sharing.disableIndex === true) return <NotFoundContent locale={params.locale} />;

	const faqJsonLd = defineFaqJsonLd(collectFaqItems(stegaClean(data.pageModules)));
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale: params.locale as Locale }) },
		{ name: data.title, path: resolveHref({ documentType: 'pGeneral', slug: params.slug, locale: params.locale as Locale }) },
	]);

	return (
		<>
			{faqJsonLd && <JsonLd data={faqJsonLd} />}
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageGeneral data={data} locale={params.locale as Locale} />
		</>
	);
}
