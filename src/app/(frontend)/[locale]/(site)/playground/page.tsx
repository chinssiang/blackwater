import type { Metadata } from 'next';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import defineMetadata from '@/lib/defineMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { LOCALES, type Locale } from '@/lib/i18n';
import { resolveHref } from '@/lib/routes';
import JsonLd from '@/components/JsonLd';
import { PagePlayground } from './_components/PagePlayground';

// Run Lab has no backing document: pPlayground is a synthetic route and every
// word on the page is dictionary copy, so there is no sanityFetch here -- and
// nothing that reads cookies, headers or searchParams, which keeps both locales
// prerendered.
export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const dict = await getDictionary(locale);
	return defineMetadata({
		data: {
			_type: 'pPlayground',
			title: dict.playground.meta.title,
			sharing: { metaDesc: dict.playground.meta.description },
		},
		locale,
		availableLocales: [...LOCALES],
	});
}

export default async function Page({
	params,
}: {
	params: Promise<{ locale: Locale }>;
}) {
	const { locale } = await params;
	const dict = await getDictionary(locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{
			name: dict.breadcrumb.home,
			path: resolveHref({ documentType: 'pHome', locale }),
		},
		{
			name: dict.breadcrumb.playground,
			path: resolveHref({ documentType: 'pPlayground', locale }),
		},
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PagePlayground />
		</>
	);
}
