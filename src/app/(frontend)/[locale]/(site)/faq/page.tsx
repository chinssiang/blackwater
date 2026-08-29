import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageFaqQuery } from '@/sanity/lib/queries';
import type { PageFaqQueryResult } from 'sanity.types';
import defineMetadata, {
	normalizeLocales,
	omitPageMetadata,
} from '@/lib/defineMetadata';
import defineFaqJsonLd from '@/lib/defineFaqJsonLd';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import { PageFaq } from './_components/PageFaq';

// The return annotation is load-bearing, not decoration. `sanityFetch` types
// `data` as `ClientReturn<typeof query>`, which looks the query string up in the
// `SanityQueries` augmentation that typegen writes into sanity.types.ts. Every
// query in queries.ts is composed from `string`-returning fragments, so its type
// is a template literal riddled with `${string}` holes, matches no concrete key,
// and falls back to `any` — taking every downstream property access with it.
// Naming the generated type here restores that checking for this route, and is
// what makes `omitPageMetadata` below deliver the compile-time guarantee it
// documents rather than a silent no-op on `any`.
const getCachedFaqData = cache(
	async (locale: string): Promise<{ data: PageFaqQueryResult }> =>
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

	// `in` rather than `?.`: baseFields projects `{...sharing, shareGraphic, siteTitle}`,
	// so a document with no `sharing` object yields an arm of the union that has
	// no `disableIndex` key. Runtime behaviour is unchanged — absent still reads
	// as "indexable" — but the check now type-checks instead of relying on `any`.
	const disableIndex =
		data && 'disableIndex' in data.sharing ? data.sharing.disableIndex : undefined;
	if (!data || disableIndex === true) return <NotFoundContent locale={locale} />;

	const cleanData = stegaClean(data);
	const faqJsonLd = defineFaqJsonLd(cleanData?.items);

	return (
		<>
			{faqJsonLd && <JsonLd data={faqJsonLd} />}
			{/* PageFaq is a client component, so everything handed to it is
			    serialized into the prerendered HTML *and* the RSC payload.
			    `sharing` and `availableLocales` are read on the SERVER only — by
			    generateMetadata and by the disableIndex guard above — so they are
			    stripped here, the same treatment the product listing pages give
			    their results. `answerText` goes too: it is a flat plain-text copy
			    of every answer, consumed only by defineFaqJsonLd above, while
			    FaqList renders the `answer` blocks themselves. */}
			<PageFaq
				data={{
					...omitPageMetadata(data),
					items: data.items?.map((item) => ({
						_id: item._id,
						question: item.question,
						answer: item.answer,
					})),
				}}
			/>
		</>
	);
}
