import dynamic from 'next/dynamic';

const Freeform = dynamic(() => import('./Freeform'));
const FaqList = dynamic(() => import('./FaqList'));

type PageModulesProps = {
	module: any;
};

export default function PageModules({ module }: PageModulesProps) {
	const type = module._type;

	switch (type) {
		case 'freeform':
			return <Freeform data={module} />;

		case 'faqList':
			return <FaqList data={module} />;

		default:
			return null;
	}
}
