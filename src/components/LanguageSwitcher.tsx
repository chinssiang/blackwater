'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	LOCALES,
	LOCALE_SHORT_LABELS,
	localizePath,
	stripLocaleFromPath,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher({
	className,
	onSelect,
}: {
	className?: string;
	onSelect?: () => void;
}) {
	const pathname = usePathname();
	const { locale: currentLocale, path: strippedPath } =
		stripLocaleFromPath(pathname);

	return (
		<div className={cn('t-b-2 flex items-center gap-2 uppercase', className)}>
			{LOCALES.map((locale, i) => {
				const isCurrent = locale === currentLocale;
				return (
					<Fragment key={locale}>
						{i > 0 && <span aria-hidden="true">|</span>}
						{isCurrent ? (
							<span aria-current="true" className="text-foreground">
								{LOCALE_SHORT_LABELS[locale]}
							</span>
						) : (
							<Link
								href={localizePath(strippedPath, locale)}
								onClick={onSelect}
								className="text-muted-foreground transition-colors hover:text-foreground"
							>
								{LOCALE_SHORT_LABELS[locale]}
							</Link>
						)}
					</Fragment>
				);
			})}
		</div>
	);
}
