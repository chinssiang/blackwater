import PageModules from '@/components/PageModules';
import { findHeadingHeroKey } from '@/lib/page-modules';
import type { Locale } from '@/lib/i18n';
import { AnimatedTitle } from './AnimatedTitle';

interface PageHomeProps {
	data: {
		pageModules?: Array<any>;
		landingTitle?: string;
	};
	locale: Locale;
}

export default function PageHome({ data, locale }: PageHomeProps) {
	const { pageModules, landingTitle } = data || {};

	// The homepage heading lives in a heroBlock now, and this is the module that
	// supplies it -- the FIRST hero carrying a heading, not whatever sits in slot
	// 0 and not merely any heroBlock. An empty hero renders nothing, and a hero an
	// editor moved below a freeform intro still owns the page's <h1>; keying off
	// either alone drops the <h1> the page used to be guaranteed.
	//
	// `landingTitle` is the transition tail: it renders only while no module
	// supplies a heading, so the code and scripts/migrate-home-hero.mjs can be
	// deployed in either order without a window where the homepage has none.
	// Delete this branch, the AnimatedTitle component, and the `landingTitle`
	// projection in pageHomeQuery once the script has run against prod.
	const headingHeroKey = findHeadingHeroKey(pageModules);

	return (
		<>
			{!headingHeroKey && (
				<div className="min-h-main flex flex-col justify-center py-40">
					<div className="px-contain mx-auto max-w-sm text-center text-sm text-balance uppercase sm:max-w-6xl">
						<AnimatedTitle title={landingTitle} />
					</div>
				</div>
			)}
			{pageModules?.map((module) => (
				<PageModules
					key={module._key}
					module={module}
					locale={locale}
					// The hero that supplies the page heading owns the h1; every other
					// module falls through to HeroBlock's own 'h2' default, the same as
					// PageGeneral, which passes nothing at all.
					headingLevel={module._key === headingHeroKey ? 'h1' : undefined}
				/>
			))}
		</>
	);
}
