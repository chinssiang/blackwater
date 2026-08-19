import type { Viewport } from 'next';
import ProductSubmissionLazy from '@/components/ProductSubmissionLazy';
import { getCachedSiteData } from '@/sanity/lib/siteData';

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
	const { data } = await getCachedSiteData(locale);

	return (
		// No gutter here: each child section carries its own `mx-max` instead, so a
		// section that should reach the window edge — the product gallery's
		// carousel, which scrolls slides in and out past the left edge — just omits
		// it and is genuinely full-width, rather than cancelling an inherited
		// padding with a negative margin that has to stay exactly in step with it.
		// The cost is that a new top-level section is full-bleed until it opts in.
		<div className="min-h-main py-10 lg:py-17.5 flex-col flex">
			{children}
			{data?.productSubmissionEmail && (
				<div className="mx-max pointer-events-none sticky bottom-[calc(var(--height-g-toolbar)+1rem)] mt-auto flex justify-end lg:bottom-6 z-11 pt-section">
					<ProductSubmissionLazy />
				</div>
			)}
		</div>
	);
}
