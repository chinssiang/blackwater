import PageModules from '@/components/PageModules';
import { AnimatedTitle } from './AnimatedTitle';

interface PageHomeProps {
	data: {
		pageModules?: Array<any>;
		landingTitle?: string;
	};
}

export default function PageHome({ data }: PageHomeProps) {
	const { pageModules, landingTitle } = data || {};

	return (
		<div className="p-home flex min-h-[inherit] flex-col justify-center gap-5">
			<div className="px-contain mx-auto max-w-sm text-center text-sm text-balance uppercase sm:max-w-6xl">
				<AnimatedTitle title={landingTitle} />
			</div>
			{pageModules?.map((module) => (
				<PageModules key={module._key} module={module} />
			))}
		</div>
	);
}
