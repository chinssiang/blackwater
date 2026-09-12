import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageHomeQuery, PAGE_MODULE_TAGS } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import defineFaqJsonLd, { collectFaqItems } from '@/lib/defineFaqJsonLd';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import PageHome from '../_components/PageHome';

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

const getCachedHomeData = cache(async (locale: string) =>
	sanityFetch({
		query: pageHomeQuery,
		params: { locale },
		tags: ['pHome', ...PAGE_MODULE_TAGS],
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

	const faqJsonLd = defineFaqJsonLd(
		collectFaqItems(stegaClean(data.pageModules))
	);

	return (
		<>
			{faqJsonLd && <JsonLd data={faqJsonLd} />}
			<PageHome data={data} locale={locale as Locale} />
		</>
	);
}
