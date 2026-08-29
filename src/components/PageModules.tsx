import dynamic from 'next/dynamic';
import FaqBlock from './FaqBlock';

// Freeform is 'use client', so splitting it out of the shared chunk is a real
// saving. FaqBlock is a Server Component and is imported statically above: there
// is no client chunk to split, and the lazy boundary would only add another
// suspend point for the stream to flush at.
const Freeform = dynamic(() => import('./Freeform'));

type PageModulesProps = {
	module: any;
};

export default function PageModules({ module }: PageModulesProps) {
	const type = module._type;

	switch (type) {
		case 'freeform':
			return <Freeform data={module} />;

		case 'faqBlock':
			return <FaqBlock data={module} />;

		default:
			return null;
	}
}
