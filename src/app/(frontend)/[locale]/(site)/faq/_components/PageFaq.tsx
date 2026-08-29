'use client';
import FaqBlock, { type FaqItem } from '@/components/FaqBlock';

interface PageFaqData {
	title?: string | null;
	intro?: string | null;
	items?: FaqItem[];
}

interface PageFaqProps {
	data?: PageFaqData;
}

export function PageFaq({ data }: PageFaqProps) {
	const { title, intro, items } = data || {};

	return (
		<div className="p-x-md min-h-[85vh] md:min-h-main py-10 lg:py-17.5 px-max">
			<div className="text-foreground">
				{title && <h1 className="t-h-3 uppercase">{title}</h1>}
				{intro && <p className="mt-2 whitespace-pre-line">{intro}</p>}
			</div>
			<FaqBlock
				data={{ items, sectionAppearance: { maxWidth: 'none' } }}
				className="mt-10"
			/>
		</div>
	);
}
