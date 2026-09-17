'use client';

import { Fragment, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
	LOCALES,
	LOCALE_SHORT_LABELS,
	type Locale,
	isLocaleExemptPath,
	localizePathWithSearch,
	stripLocaleFromPathname,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';

type LanguageSwitcherProps = {
	className?: string;
	onSelect?: () => void;
};

type SwitcherProps = LanguageSwitcherProps & {
	currentLocale: Locale;
	path: string;
};

export default function LanguageSwitcher({
	className,
	onSelect,
}: LanguageSwitcherProps) {
	const pathname = usePathname();

	// Routes like /email-signature and /events-crew exist only at the default
	// locale, so there is nothing to switch to — hide the toggle entirely.
	if (isLocaleExemptPath(pathname)) return null;

	const { locale: currentLocale, path } = stripLocaleFromPathname(pathname);
	const props: SwitcherProps = { className, onSelect, currentLocale, path };

	// This is header chrome, mounted on EVERY route, and nearly all of them are
	// prerendered. `useSearchParams()` opts its CALLER out of the prerender, so
	// the hook lives one component down and this boundary — which has to be an
	// ANCESTOR of the caller, never a sibling or a child of it — is what stops
	// that opt-out reaching the header and failing the production build with
	// "Missing Suspense boundary with useSearchParams".
	//
	// The fallback is the same markup with no query, which is the right answer on
	// every prerendered route: none of them carry filter params, so their HTML is
	// unchanged from before this file grew a boundary. /products/all is the only
	// route with params and it is dynamic, so there the children render on the
	// server and the real hrefs ship in the HTML.
	return (
		<Suspense fallback={<Switcher {...props} search="" />}>
			<SwitcherWithSearch {...props} />
		</Suspense>
	);
}

function SwitcherWithSearch(props: SwitcherProps) {
	const search = useSearchParams().toString();
	return <Switcher {...props} search={search} />;
}

function Switcher({
	className,
	onSelect,
	currentLocale,
	path,
	search,
}: SwitcherProps & { search: string }) {
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
								href={localizePathWithSearch(path, locale, search)}
								onClick={onSelect}
								className="text-muted-foreground hover:text-foreground transition-colors"
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
