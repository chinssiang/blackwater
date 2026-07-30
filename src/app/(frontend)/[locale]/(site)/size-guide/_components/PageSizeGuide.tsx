'use client';

import SizeChartTable, { type SizeChart } from '@/components/SizeChartTable';
import { useTranslations } from '@/components/LocaleProvider';

interface PageSizeGuideData {
	title?: string | null;
	intro?: string | null;
	footnote?: string | null;
	charts?: SizeChart[] | null;
}

interface PageSizeGuideProps {
	data?: PageSizeGuideData;
}

export function PageSizeGuide({ data }: PageSizeGuideProps) {
	const t = useTranslations('sizeGuide');
	const { title, intro, footnote, charts } = data || {};
	const chartList = (charts ?? []).filter(Boolean);

	return (
		<div className="p-x-md min-h-[85vh] md:min-h-main py-10 lg:py-17.5">
			<div className="text-foreground">
				{title && <h1 className="t-h-3 uppercase">{title}</h1>}
				{intro && <p className="t-b-1 mt-2 whitespace-pre-line">{intro}</p>}
			</div>

			{chartList.length ? (
				<div className="mt-10 space-y-14 lg:space-y-20">
					{chartList.map((chart, index) => (
						<SizeChartTable key={chart._id ?? index} chart={chart} />
					))}
				</div>
			) : (
				<p className="t-b-1 text-muted-foreground mt-10">{t.empty}</p>
			)}

			{footnote && (
				<p className="t-b-2 text-muted-foreground mt-14 whitespace-pre-line lg:mt-20">
					{footnote}
				</p>
			)}
		</div>
	);
}
