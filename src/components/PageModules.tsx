import dynamic from 'next/dynamic';
import FaqBlock from './FaqBlock';
import EventsBlock from './EventsBlock';
import HeroBlock from './HeroBlock';
import ProductsBlock from './ProductsBlock';
import type { Locale } from '@/lib/i18n';

// Freeform is 'use client', so splitting it out of the shared chunk is a real
// saving. FaqBlock, HeroBlock and ProductsBlock are Server Components with no
// client chunk to split, so they are imported statically above and the lazy
// boundary would only add another suspend point for the stream to flush at.
// EventsBlock is also a Server Component but now has a transitive client chunk
// (embla, via EventsCarousel); it owns that split itself rather than exporting
// the problem here, because the weight is the carousel's, not the module's.
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
