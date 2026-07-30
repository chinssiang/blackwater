'use client';

import { isRenderable } from '@/components/SizeChartTable';
import { useTranslations } from '@/components/LocaleProvider';
import {
	SizeGuideSection,
	type SizeGuideSectionData,
} from './SizeGuideSection';

interface PageSizeGuideData {
	title?: string | null;
	intro?: string | null;
	footnote?: string | null;
	sections?: SizeGuideSectionData[] | null;
}

interface PageSizeGuideProps {
	data?: PageSizeGuideData;
}

export function PageSizeGuide({ data }: PageSizeGuideProps) {
	const t = useTranslations('sizeGuide');
	const { title, intro, footnote, sections } = data || {};

	// Gate on charts that will actually render, not on how many were referenced:
	// SizeChartTable returns null for a chart with no columns or no rows, so a set
	// of half-authored drafts would otherwise show neither tables nor the
	// empty-state message — a silently blank page in Presentation. SizeGuideSection
	// applies the same predicate to its tabs, so a section that survives here
	// always has at least one tab to show.
	const sectionList = (sections ?? []).filter((section) =>
		(section?.charts ?? []).some((chart) => chart && isRenderable(chart))
	);

	return (
		<div className="p-x-md min-h-[85vh] md:min-h-main py-10 lg:py-17.5">
			<div className="text-foreground">
				{title && <h1 className="t-h-3 uppercase">{title}</h1>}
				{intro && <p className="t-b-1 mt-2 whitespace-pre-line">{intro}</p>}
			</div>

			{sectionList.length ? (
				<div className="mt-10 space-y-14 lg:space-y-20">
					{sectionList.map((section, index) => (
						<SizeGuideSection key={section._key ?? index} section={section} />
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
