import dynamic from 'next/dynamic';
import FaqBlock from './FaqBlock';
import EventsBlock from './EventsBlock';
import ProductsBlock from './ProductsBlock';
import type { Locale } from '@/lib/i18n';

// Freeform is 'use client', so splitting it out of the shared chunk is a real
// saving. FaqBlock, EventsBlock and ProductsBlock are Server Components and are
// imported statically above: there is no client chunk to split, and the lazy
// boundary would only add another suspend point for the stream to flush at.
const Freeform = dynamic(() => import('./Freeform'));

type PageModulesProps = {
	module: any;
	// EventsBlock and ProductsBlock resolve strings and prices on the server, so
	// they need the locale as a prop rather than through LocaleProvider's client
	// context. Passed down from PageHome/PageGeneral.
	locale: Locale;
};

export default function PageModules({ module, locale }: PageModulesProps) {
	const type = module._type;

	switch (type) {
		case 'freeform':
			return <Freeform data={module} />;

		case 'faqBlock':
			return <FaqBlock data={module} />;

		case 'eventsBlock':
			return <EventsBlock data={module} locale={locale} />;

		case 'productsBlock':
			return <ProductsBlock data={module} locale={locale} />;

		default:
			return null;
	}
}
