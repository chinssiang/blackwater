import dynamic from 'next/dynamic';
import type { Locale } from '@/lib/i18n';
import EventsBlock from './EventsBlock';
import FaqBlock from './FaqBlock';
import HeroBlock from './HeroBlock';
import ProductsBlock from './ProductsBlock';

// FaqBlock and ProductsBlock are Server Components with no client chunk to
// split, so they are imported statically. The other three carry client code,
// and a dynamic() called from a Server Component -- this file's Freeform below,
// and EventsBlock's dynamic(EventsCarousel) -- does NOT code-split: measured on
// a production build, Freeform's and the carousel's code both ride in the
// homepage and /[slug] route chunks, on pages that render neither. Only a
// dynamic() inside a 'use client' module is a real boundary, which is how
// HeroBlock reaches its canvas (HeroWaveLazy). The Freeform and EventsCarousel
// calls are left as they are pending that same treatment.
const Freeform = dynamic(() => import('./Freeform'));

type PageModulesProps = {
	module: any;
	// EventsBlock and ProductsBlock resolve strings and prices on the server, so
	// they need the locale as a prop rather than through LocaleProvider's client
	// context. Passed down from PageHome/PageGeneral.
	locale: Locale;
	headingLevel?: 'h1' | 'h2';
	/**
	 * Whether this module owns the page's single weather widget. Decided by the
	 * page component, which picks the first heroBlock in the array; only
	 * heroBlock reads it.
	 *
	 * Ownership rather than position, and NOT derived from `headingLevel`: both
	 * pageModules arrays allow any number of heroBlocks with no max(), so
	 * something has to choose, but "is slot 0" answers the wrong question — a
	 * builder of [freeform, heroBlock] has a perfectly good hero at index 1 and
	 * would get no widget at all. `headingLevel` cannot stand in either, since
	 * PageGeneral renders its own <h1> and passes no level, leaving every one of
	 * its modules at the 'h2' default.
	 */
	ownsWeatherWidget?: boolean;
	/**
	 * Whether this is the page's FIRST module — what a visitor sees on the first
	 * paint, and so where the LCP element lives. Only heroBlock reads it, to drop
	 * the entrance fade from a heading Chrome is about to measure.
	 *
	 * Deliberately separate from `headingLevel`, which looks like the same fact
	 * and is not: PageGeneral renders its own <h1> and passes no level, so every
	 * one of its modules sits at the 'h2' default while still being able to open
	 * the page. Also separate from `ownsWeatherWidget`, which is ownership rather
	 * than position for the reason above.
	 */
	isPageOpener?: boolean;
};

export default function PageModules({
	module,
	locale,
	headingLevel,
	ownsWeatherWidget,
	isPageOpener,
}: PageModulesProps) {
	const type = module._type;

	switch (type) {
		case 'freeform':
			return <Freeform data={module} />;

		case 'faqBlock':
			return <FaqBlock data={module} headingLevel={headingLevel} />;

		case 'eventsBlock':
			return (
				<EventsBlock
					data={module}
					locale={locale}
					headingLevel={headingLevel}
				/>
			);

		case 'heroBlock':
			return (
				<HeroBlock
					data={module}
					headingLevel={headingLevel}
					ownsWeatherWidget={ownsWeatherWidget}
					isPageOpener={isPageOpener}
				/>
			);

		case 'productsBlock':
			return (
				<ProductsBlock
					data={module}
					locale={locale}
					headingLevel={headingLevel}
				/>
			);

		default:
			return null;
	}
}
