import type { Viewport } from 'next';
import { ProductSubmission } from '@/components/ProductSubmission';
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
		<div className="p-x-max min-h-main py-10 lg:py-17.5 flex-col flex">
			{children}
			{data?.productSubmissionEmail && (
				<div className="pointer-events-none sticky bottom-[calc(var(--height-g-toolbar)+1rem)] mt-auto flex justify-end lg:bottom-6 z-11">
					<ProductSubmission />
				</div>
			)}
		</div>
	);
}
