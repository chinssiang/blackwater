import { notFound } from 'next/navigation';
import { LocaleProvider } from '@/components/LocaleProvider';
import { LOCALES, type Locale, isLocale } from '@/lib/i18n';

export function generateStaticParams() {
	return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	return <LocaleProvider locale={locale as Locale}>{children}</LocaleProvider>;
}
