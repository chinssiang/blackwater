'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, localizePath, stripLocaleFromPath } from '@/lib/i18n';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '@/components/ui/DropdownMenu';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher({ className }: { className?: string }) {
	const pathname = usePathname();
	const { locale: currentLocale, path: strippedPath } = stripLocaleFromPath(pathname);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Switch language"
					className={cn('inline-flex items-center outline-none focus-visible:underline', className)}
				>
					<Globe className="size-4" aria-hidden="true" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-32">
				{LOCALES.map((locale) => {
					const isCurrent = locale === currentLocale;
					if (isCurrent) {
						return (
							<DropdownMenuItem key={locale} disabled className="justify-between">
								{LOCALE_LABELS[locale]}
								<Check className="ml-2 size-3.5" />
							</DropdownMenuItem>
						);
					}
					return (
						<DropdownMenuItem key={locale} asChild>
							<Link href={localizePath(strippedPath, locale)}>
								{LOCALE_LABELS[locale]}
							</Link>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
