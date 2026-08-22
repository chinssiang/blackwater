import type { Metadata } from 'next';
import { type Locale } from '@/lib/i18n';
import { notFoundMetadata } from '@/lib/defineMetadata';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';

// Every path reaching this catch-all is a not-found, and the response is a soft
// 404 (HTTP 200), so it must be explicitly de-indexed — otherwise crawlers index
// arbitrary URLs under /[locale] as real pages.
export function generateMetadata(): Metadata {
	return notFoundMetadata();
}

// Catch-all for unmatched paths under /[locale]. notFound() can't render a
// styled boundary in this app, so render the 404 content inline (localized).
export default async function CatchAllNotFound({
	params,
}: {
	params: Promise<{ locale: string; rest: string[] }>;
}) {
	const { locale } = await params;
	return <NotFoundContent locale={locale as Locale} />;
}
