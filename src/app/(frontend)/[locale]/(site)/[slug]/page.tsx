import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageGeneralQuery,
	pageGeneralSlugsQuery,
	PAGE_MODULE_TAGS,
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

// pageModules can carry an eventsBlock, whose rows are decided from the wall
// clock rather than from content, so tag invalidation alone would serve
// build-time state forever. Composes with the content tags rather than replacing
// them; this is still SSG with ISR, not dynamic rendering, and it does NOT cap
// the deliberate no-TTL Storefront fetches (Next takes the minimum only across
// *lower* fetch revalidates, and `false` is infinite, not lower).
//
// The honest cost is scope: this route's pages are hourly-ISR whether or not
// they carry the module, because a segment revalidate must be a static literal
// and cannot be derived from page content. `use cache` + `cacheLife` would be
// the per-module answer and is blocked — see next.config.mjs, where it was tried
// and reverted because next-sanity's sanityFetch calls draftMode() internally.
export const revalidate = 3600;

const getCachedPageData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageGeneralQuery,
		params: { slug, locale },
		tags: [`pGeneral:${slug}`, ...PAGE_MODULE_TAGS],
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
