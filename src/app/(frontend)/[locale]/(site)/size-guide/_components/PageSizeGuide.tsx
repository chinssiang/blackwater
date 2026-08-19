'use client';

import { useMemo, useState } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { isRenderable, type SizeChart } from '@/components/SizeChartTable';
import { useTranslations } from '@/components/LocaleProvider';
import { resolveUnit, type SizeUnit } from '@/lib/size-measurements';
import SizeGuideNav from './SizeGuideNav';
import {
	SizeGuideSection,
	type SizeGuideSectionData,
	type SizeGuideTabData,
} from './SizeGuideSection';

interface RawTab {
	_key?: string | null;
	label?: string | null;
	chart?: SizeChart | null;
}

interface RawSection {
	_key?: string | null;
	title?: string | null;
	charts?: (RawTab | null)[] | null;
}

interface PageSizeGuideData {
	title?: string | null;
	intro?: string | null;
	footnote?: string | null;
	sections?: (RawSection | null)[] | null;
}

interface PageSizeGuideProps {
	data?: PageSizeGuideData;
}

/**
 * Flattens the query result into what both the nav and the sections render,
 * filtering once. Gating on charts that will actually render — rather than on
 * how many were referenced — matters because SizeChartTable returns null for a
 * chart with no sizes or no rows, so a set of half-authored drafts would
 * otherwise show neither tables nor the empty-state message: a silently blank
 * page in Presentation.
 */
function normalizeSections(
	sections: PageSizeGuideData['sections']
): SizeGuideSectionData[] {
	// The schema blocks publishing the same chart into two sections, but drafts
	// render unvalidated — without this render-side dedupe, a duplicate would
	// emit two identical DOM ids and both sections' hash listeners would fight
	// over scroll in Presentation.
	const seen = new Set<string>();

	return (sections ?? []).flatMap((section, sectionIndex) => {
		const tabs = (section?.charts ?? []).flatMap<SizeGuideTabData>((tab) => {
			const chart = tab?.chart;
			if (!chart || !isRenderable(chart)) return [];

			// This value is both a DOM id and a URL hash, so it has to be clean:
			// in draft mode Sanity encodes invisible metadata into strings, and an
			// id carrying zero-width characters can never match a hash. Only this
			// field is cleaned — the labels keep their encoding, which is what
			// powers click-to-edit in Presentation.
			const value = stegaClean(chart.slug) || stegaClean(chart._id);
			if (!value || seen.has(value)) return [];
			seen.add(value);

			return [
				{
					value,
					label: tab?.label || chart.title || '',
					title: chart.title || '',
					chart,
				},
			];
		});

		if (!tabs.length) return [];

		return [
			{
				// _key is stable across title edits and can't collide with a chart
				// slug, which is the other kind of hash target on this page.
				id: `size-${section?._key ?? sectionIndex}`,
				title: section?.title || '',
				tabs,
			},
		];
	});
}

export function PageSizeGuide({ data }: PageSizeGuideProps) {
	const t = useTranslations('sizeGuide');
	const { title, intro, footnote, sections } = data || {};

	// Memoized (house style — see PageEvents): this component owns displayUnit,
	// so every unit toggle re-renders it, and without the memo each toggle would
	// re-run stegaClean over every chart and hand children fresh identities.
	const sectionList = useMemo(() => normalizeSections(sections), [sections]);

	// Shared across sections: the control renders once per section header, as
	// designed, but a reader picking inches means every table.
	const [displayUnit, setDisplayUnit] = useState<SizeUnit>(() =>
		resolveUnit(stegaClean(sectionList[0]?.tabs[0]?.chart.unit))
	);

	// grid-rows-[auto_1fr] is load-bearing: with two auto rows, the row-spanning
	// content column donates half its height to row 1 and shoves the nav hundreds
	// of pixels down the page. Pinning row 1 to the title's own height sends the
	// remainder to row 2, which is the tall row the nav sticks within.
	return (
		<div className="px-max min-h-[85vh] py-10 md:min-h-main lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10 lg:py-17.5">
			<div className="lg:col-start-1 lg:row-start-1">
				{title && <h1 className="t-l-1 uppercase">{title}</h1>}
				{intro && (
					<p className="t-b-2 text-muted-foreground mt-2 whitespace-pre-line">
						{intro}
					</p>
				)}
			</div>

			{/* The nav is sticky in both layouts. lg:row-span-2 on the content column
			    is what stretches the nav's grid row tall enough for it to travel. */}
			<SizeGuideNav
				sections={sectionList}
				className="mt-5 lg:col-start-1 lg:row-start-2 lg:mt-13 lg:self-start"
			/>

			<div className="mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
				{sectionList.length ? (
					<div className="space-y-14 lg:space-y-20">
						{sectionList.map((section) => (
							<SizeGuideSection
								key={section.id}
								section={section}
								displayUnit={displayUnit}
								onUnitChange={setDisplayUnit}
							/>
						))}
					</div>
				) : (
					<p className="t-b-1 text-muted-foreground">{t.empty}</p>
				)}

				{footnote && (
					<p className="t-b-2 text-muted-foreground mt-14 whitespace-pre-line lg:mt-20">
						{footnote}
					</p>
				)}
			</div>
		</div>
	);
}
