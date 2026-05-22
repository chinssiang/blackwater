'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, localizePath, stripLocaleFromPath } from '@/lib/i18n';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher({ className }: { className?: string }) {
	const currentLocale = useLocale();
	const pathname = usePathname();
	const { path: strippedPath } = stripLocaleFromPath(pathname);

	return (
		<span className={cn('flex items-center gap-0.5', className)}>
			{LOCALES.map((locale, index) => (
				<span key={locale} className="flex items-center gap-0.5">
					{index > 0 && <span className="text-muted">/</span>}
					{locale === currentLocale ? (
						<span>{LOCALE_LABELS[locale]}</span>
					) : (
						<Link
							href={localizePath(strippedPath, locale)}
							className="text-muted hover:text-foreground transition-colors"
						>
							{LOCALE_LABELS[locale]}
						</Link>
					)}
				</span>
			))}
		</span>
	);
}
