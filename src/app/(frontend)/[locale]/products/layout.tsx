import { ProductSubmission } from '@/components/ProductSubmission';
import { getCachedSiteData } from '@/sanity/lib/siteData';

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
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			{children}
			{data?.productSubmissionEmail && (
				<div className="pointer-events-none sticky bottom-[calc(var(--height-g-toolbar)+1rem)] z-1 flex justify-end lg:bottom-6 z-11">
					<ProductSubmission />
				</div>
			)}
		</div>
	);
}
