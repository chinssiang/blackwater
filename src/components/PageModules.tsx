import dynamic from 'next/dynamic';

const Freeform = dynamic(() => import('./Freeform'));

type PageModulesProps = {
	module: any;
};

export default function PageModules({ module }: PageModulesProps) {
	const type = module._type;

	switch (type) {
		case 'freeform':
			return <Freeform data={module} />;

		default:
			return null;
	}
}
