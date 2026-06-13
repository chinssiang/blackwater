import { type Locale } from '@/lib/i18n';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';

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
