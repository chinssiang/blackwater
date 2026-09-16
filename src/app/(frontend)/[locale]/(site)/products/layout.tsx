import type { Viewport } from 'next';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';
import ProductSubmissionLazy from '@/components/ProductSubmissionLazy';

// Let the soft keyboard resize the layout viewport (not just the visual one) so
// the mobile product-submission dialog's svh-based sizing recomputes against
// the visible area and stays clear of the keyboard (iOS ignores this, but the
// dialog is top-anchored so it fits regardless). Scoped to the products
// subtree where the FAB lives.
export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	interactiveWidget: 'resizes-content',
};

export default async function ProductsLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	// Narrowed rather than cast: the segment is a URL string, and the tag
	// `locale:<locale>` it keys is now type-checked, so an unrecognised value
	// must resolve to a real locale instead of minting a bogus cache tag.
	const { data } = await getCachedSiteData(
		isLocale(locale) ? locale : DEFAULT_LOCALE
	);

	return (
		// No gutter here: each child section carries its own `m-x-max` instead, so a
		// section that should reach the window edge — the product gallery's
		// carousel, which scrolls slides in and out past the left edge — just omits
		// it and is genuinely full-width, rather than cancelling an inherited
		// padding with a negative margin that has to stay exactly in step with it.
		// The cost is that a new top-level section is full-bleed until it opts in.
		<div className="min-h-main flex flex-col py-10 lg:py-17.5">
			{children}
			{data?.productSubmissionEmail && (
				<div className="m-x-max pt-section pointer-events-none sticky bottom-[calc(var(--height-g-toolbar)+1rem)] z-11 mt-auto flex justify-end lg:bottom-6">
					<ProductSubmissionLazy />
				</div>
			)}
		</div>
	);
}
