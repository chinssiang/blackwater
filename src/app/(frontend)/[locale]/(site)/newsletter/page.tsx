import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageNewsletterQuery } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { type Locale } from '@/lib/i18n';
import { PageNewsletter } from './_components/PageNewsletter';

const getCachedNewsletterData = cache(async (locale: string) =>
	sanityFetch({
		query: pageNewsletterQuery,
		params: { locale },
		tags: ['pNewsletter', 'gNewsletter'],
	})
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedNewsletterData(locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedNewsletterData(locale);

	const { sharing } = data || {};
	if (!data || sharing?.disableIndex === true) return <NotFoundContent locale={locale} />;

	return <PageNewsletter data={data} />;
}
