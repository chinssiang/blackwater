import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache, Suspense } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import type { PageEventSingleQueryResult } from 'sanity.types';
import {
	pageEventSingleQuery,
	pageEventSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales, notFoundMetadata } from '@/lib/defineMetadata';
import defineEventJsonLd from '@/lib/defineEventJsonLd';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import PageEventSingle from '../_components/PageEventSingle';
import EventRelated, {
	getCachedRelatedEvents,
} from '../_components/EventRelated';

// Matches /events. Whether an event has ended, how many days until it starts,
// and the upcoming/past split of the related strip are all read off the wall
// clock at render, and no content edit invalidates any of them — so without a
// TTL a prerendered ended event keeps advertising its registration link
// forever. Still SSG with ISR, and it composes with the content tags rather
// than replacing them.
export const revalidate = 3600;

// Takes the parent [locale] segment's param: pageEventSlugsQuery applies the
// locale-visibility guard, so this has to run per locale rather than emit one
// slug list for both. Its result type flows on its own -- `titleVisible` is a
// plain const string, so interpolating it keeps the template-literal type that
// indexes Sanity's query->result map. (What loses the type is a helper CALL in
// a hole, e.g. locString(...) or ${eventCardFields} -- which is why the
// single-document query below needs an explicit annotation and this does not.)
export async function generateStaticParams({
	params,
}: {
	params: { locale: string };
}): Promise<{ slug: string | null }[]> {
	const { data } = await sanityFetch({
		query: pageEventSlugsQuery,
		params: { locale: params.locale },
		perspective: 'published',
		stega: false,
		// Without a tag this list caches forever under the catch-all 'sanity'
		// tag, which nothing invalidates — so a build could reuse a stale slug
		// list and skip prerendering a newly published document.
		tags: ['pEvent'],
	});

	return data ?? [];
}

type MetadataProps = {
	params: Promise<{ locale: string; slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Annotated, not inferred: `pageEventSingleQuery` is built from interpolated
// helpers, so TypeScript cannot fold it into the string literal that indexes
// Sanity's query→result map, and `data` would silently arrive as `any` — which
// is exactly what it did until this annotation, taking PageEventSingle's props
// down with it. Same reason /events/page.tsx annotates its own fetch.
const getCachedEventData = cache(
	async (
		slug: string,
		locale: string
	): Promise<{ data: PageEventSingleQueryResult }> =>
		sanityFetch({
			query: pageEventSingleQuery,
			params: { slug, locale },
			// The detail query derefs locationRef-> (gLocation), categories[]->
			// (pEventCategory) and statusList's eventStatus-> plus its color refs
			// (pEventStatus, settingsBrandColors).
			tags: [
				`pEvent:${slug}`,
				'gLocation',
				'pEventCategory',
				'pEventStatus',
				'settingsBrandColors',
			],
		})
);

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
	const { slug, locale } = await props.params;
	const { data } = await getCachedEventData(slug, locale);
	const cleanData = stegaClean(data);
	// Missing/untranslated document → the page renders NotFoundContent at HTTP
	// 200, so de-index it rather than letting defineMetadata default to index.
	if (!cleanData) return notFoundMetadata();
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function PageEventSlugRoute(props: MetadataProps) {
	const { slug, locale } = await props.params;
	// Kicked off before the await, not inside EventRelated's render: the related
	// strips take only (slug, locale), so they never needed to queue behind the
	// document read. EventRelated awaits the same cache() entry and hits the
	// memo. Without this the two round trips are serial on every one of the 178
	// prerendered pages, and again on each hourly regeneration.
	//
	// Unconditional on purpose: priming it after the `!data` check below would
	// serialize it again, which is the whole cost being removed. The trade is
	// that an on-demand render of a missing or untranslated slug performs one
	// query it then discards -- paid only off the prerendered path, where the
	// slug list guarantees the document exists.
	const relatedEvents = getCachedRelatedEvents(slug, locale);

	// Independent: the event document is a Sanity round trip, the dictionary a
	// local import. Awaited in sequence the dictionary sat behind the network
	// call for no reason — same shape as the product routes.
	const [{ data }, dict] = await Promise.all([
		getCachedEventData(slug, locale),
		getDictionary(locale as Locale),
	]);

	if (!data) {
		// Nothing will await the in-flight related fetch on this path.
		void relatedEvents.catch(() => {});
		return <NotFoundContent locale={locale} />;
	}

	const cleanData = stegaClean(data);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale: locale as Locale }) },
		{ name: dict.breadcrumb.events, path: resolveHref({ documentType: 'pEvents', locale: locale as Locale }) },
		{ name: cleanData?.title, path: resolveHref({ documentType: 'pEvent', slug, locale: locale as Locale }) },
	]);

	const relatedSlot = (
		// fallback={null} on purpose: it is below the fold, and a heading would
		// promise content that may not exist. This buys no TTFB on the prerendered
		// path -- Next resolves the boundary during prerender -- but it isolates
		// the slot and helps on-demand renders (draft mode). EventRelated takes
		// only (slug, locale), so it needs nothing out of the fetch above.
		<Suspense fallback={null}>
			<EventRelated slug={slug} locale={locale as Locale} t={dict.events} />
		</Suspense>
	);

	return (
		<>
			<JsonLd data={defineEventJsonLd({ data: cleanData, locale: locale as Locale })} />
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageEventSingle
				data={data}
				locale={locale as Locale}
				t={dict.events}
				relatedSlot={relatedSlot}
			/>
		</>
	);
}
