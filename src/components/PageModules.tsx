import dynamic from 'next/dynamic';
import FaqBlock from './FaqBlock';
import EventsBlock from './EventsBlock';
import HeroBlock from './HeroBlock';
import ProductsBlock from './ProductsBlock';
import type { Locale } from '@/lib/i18n';

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
	/**
	 * The tag for the module's own heading. The homepage passes 'h1' for slot 0,
	 * because nothing above it claims the page's heading; PageGeneral leaves it
	 * alone, since it renders the page title as an h1 itself. Threaded to every
	 * type that renders a heading, not just heroBlock -- slot 0 is decided by
	 * POSITION, and hidden modules are filtered in GROQ, so any type can end up
	 * there.
	 */
	headingLevel?: 'h1' | 'h2';
};

export default function PageModules({
	module,
	locale,
	headingLevel,
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
			return <HeroBlock data={module} headingLevel={headingLevel} />;

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
